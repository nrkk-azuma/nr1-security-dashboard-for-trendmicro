import React from 'react';
import { NrqlQuery, NerdGraphQuery, PlatformStateContext, HeadingText,List, ListItem,
    LineChart, ChartGroup, AreaChart, Card, CardHeader, CardBody,
    Stack, StackItem, AutoSizer,
    Grid, GridItem } from 'nr1';

export default class InstanceCorrelation extends React.Component {

    tooltip = 'instanceCorrelation';
    nrql=`
query ($accountId: [EntityGuid]!, $query: String){
  actor {
    account(id: $accountId) {
      nrql(query: $query) {
        embeddedChartUrl
        nrql
        otherResult
        results
      }
    }
  }
}

`;
    color = {
        "AntiMalwareEvent": '#466ba4',
        "LogInspectionEvent": '#665889',
        "IntegrityEvent": '#dc6a05',
        "PayloadLog": '#6d7419',
        "AppControlEvent": '#f5b613',
        "WebReputationEvent": '#419865',
        "FirewallEvent": '#a32d2e',
        "SystemEvent": '#aaaaaa'
    }

    constructor(props) {
        super(props);
        if (!this.props.accountId) {
            throw "You should set accountId to use InstanceCorrelation";
        }
        this.state = {
            accountId: this.props.accountId,
            timeRange: this.props.timeRange,
            selectedEntities: this.props.selectedEntities,
            duration: 0,
            begin_time: 0,
            end_time: 0,
            data: []
        };
        this.colorMap = {};
    }

    componentDidUpdate(prevProps) {
        if (this.props.accountId !== prevProps.accountId ||
            this.props.timeRange.since != this.state.timeRange.since
        ) {
            this.state.timeRange = this.props.timeRange;
            this.componentDidMount();
        }
    }

    componentDidMount() {

        if (!this.state.accountId) {
            return;
        }
        const since = this.state.timeRange.since;
        NerdGraphQuery.query({
            query: this.nrql,
            variables: {
                query: "FROM Transaction SELECT count(*), average(duration) FACET http.statusCode, host, appName WHERE appName in (" + this.state.selectedEntities.filter(d=>d.domain=='APM').map(d=>"'"+d.name+"'").join(',') + ") TIMESERIES " + since,
                accountId: this.state.accountId
            }
        }).then(result => {
            var dataSet = {};
            result.data.actor.account.nrql.results.forEach(d=>{
                var data = dataSet[d.facet[1]] = dataSet[d.facet[1]] || {
                    Success: {
                        Throughput: {},
                        Performance: {}
                    },
                    Failure: {
                        Throughput: {},
                        Performance: {}
                    }
                };
                var time = d.beginTimeSeconds*1000;
                var appName = d.facet[2];
                var statusCode = d.facet[0];
                var nameSpace = appName + '[' + statusCode + ']';
                if (statusCode) {
                    var target =
                    (statusCode.startsWith('2') || statusCode.startsWith('3')) ? data.Success
                        : (statusCode.startsWith('4') || statusCode.startsWith('5')) ? data.Failure
                        : null;
                    if (target) {
                        var throughput = target.Throughput = target.Throughput || {};
                        var performance = target.Performance = target.Performance || {};
                        (throughput[nameSpace] = throughput[nameSpace] || []).push({ x: time, y:d.count});
                        (performance[nameSpace] = performance[nameSpace] || []).push({ x: time, y:d['average.duration']});
                    }
                }
            });
            return dataSet;
        }).then(transaction => {
            return NerdGraphQuery.query({
                query: this.nrql,
                variables: {
                    query: "SELECT uniques(entityName) FROM SystemSample FACET hostname,ec2PublicIpAddress WHERE hostname in (" + Object.keys(transaction).map(d=>"'"+d+"'").join(',') + ") " + since,
                    accountId: this.state.accountId
                }
            }).then(result => {
                const ipMap = {};
                result.data.actor.account.nrql.results.forEach(d=>{
                    ipMap[d['uniques.entityName']] = d.facet.map(f=>f.replace(/\./g,'-'));
                });
                return { transaction, ipMap };
            })
        }).then(({ transaction, ipMap })=>{
            var hostCondition = ' AND (' + Object.values(ipMap).map(fl=>fl.map(f=>"dvchost LIKE '%" + f + "%'").join(' OR ')).join(' OR ') + ') ';
            console.log(hostCondition);
        return Promise.all([
            transaction,
            NerdGraphQuery.query({
                query: this.nrql,
                variables: {
                    query: "FROM Log SELECT count(*) FACET EventType, dvchost TIMESERIES WHERE SeverityString NOT LIKE '%Info%' " + hostCondition + since,
                    accountId: this.state.accountId
                }
            }).then(result => {
                var dataSet = {};
                result.data.actor.account.nrql.results.forEach(data => {
                    var dvchost = data.facet[1];
                    var hostname = Object.entries(ipMap).find(entry=>entry[1].find(h=>dvchost.indexOf(h)>=0))[0];
                    var eventType = data.facet[0];
                    var securityEvents = transaction[hostname].SecurityEvents = transaction[hostname].SecurityEvents || {};
                    securityEvents[eventType] = securityEvents[eventType]
                        ||{
                        metadata: {
                            name: eventType,
                            id:'instance_'+hostname+eventType,
                            viz: 'main',
                            color: this.color[eventType],
                            tooltip: this.tooltip,
                            timezone_offsets: [[
                                data.beginTimeSeconds, 32400000, 'Asia/Tokyo'
                            ]],
                            units_data: {
                                x: 'TIMESTAMP',
                                y: 'COUNT'
                            }
                            }, data: []};
                    securityEvents[eventType].data.push({
                        begin_time: data.beginTimeSeconds*1000,
                        count: data.count,
                        end_time: data.endTimeSeconds*1000,
                        x: data.beginTimeSeconds*1000,
                        y: data.count
                    });
                })
                return Object.entries(dataSet).filter(entry=>entry[0] != 'null').map(entry=>([entry[0], Object.values(entry[1])]));
            }),
            NerdGraphQuery.query({
                query: this.nrql,
                variables: {
                    query: "FROM SystemSample SELECT max(cpuPercent) as 'CPU', max(memoryUsedBytes)/max(memoryTotalBytes)*100 as 'Memory' TIMESERIES FACET hostname WHERE hostname in (" + Object.keys(transaction).map(d=>"'"+d+"'").join(',') + ") " + since,
                    accountId: this.state.accountId
                }
            }).then(result => {
                result.data.actor.account.nrql.results.forEach(d=>{
                    var hostname = d.facet;
                    var systemSample = transaction[hostname].SystemSample = transaction[hostname].SystemSample || {};
                    (systemSample.CPU = systemSample.CPU || []).push({x: d.beginTimeSeconds*1000, y: d.CPU});
                    (systemSample.Memory = systemSample.Memory || []).push({x: d.beginTimeSeconds*1000, y: d.Memory});
                });
                return [];
            })
            ]);}).then(results => {
            this.setState({ data: results })
        });

    }

    buildTimeSeries(name, data, scale) {
        return {
            metadata: {
                id: name,
                    name,
                color: this.randomColor(name),
                    viz: 'main',
                    units_data: {
                    x: 'TIMESTAMP',
                        y: scale,
                }
            },
            data
        };
    }

    randomColor(key) {
        if (this.colorMap[key]) {
            return this.colorMap[key];
        }
        let r = ('0' + Math.floor(Math.random() * 255).toString(16)).slice(-2);
        let g = ('0' + Math.floor(Math.random() * 255).toString(16)).slice(-2);
        let b = ('0' + Math.floor(Math.random() * 255).toString(16)).slice(-2);
        let color = '#' + r + g + b;
        this.colorMap[key] = color;
        return color;
    }
    render() {
        const {data} = this.state;

        return (<PlatformStateContext.Consumer>
            {platformState => {
                const {duration, begin_time, end_time} = platformState.timeRange;
                if (duration && this.state.duration !== duration ||
                    (begin_time && this.state.begin_time !== begin_time) ||
                    (end_time && this.state.end_time !== end_time)) {
                    this.state.duration = duration;
                    this.setState({duration: duration, begin_time: begin_time || 0, end_time: end_time || 0});
                    return (<></>)
                }
                return (
                    <>
                        <ChartGroup>
                            {data[0] && Object.entries(data[0]).map((entry, idx)=> {
                                return (
                                    <div>
                                    <HeadingText type={HeadingText.TYPE.HEADING_1}>{entry[0]}</HeadingText>
                                        <Grid
                                            spacingType={[
                                                Grid.SPACING_TYPE.MEDIUM,
                                                Grid.SPACING_TYPE.NONE
                                            ]}
                                        >
                                            <GridItem columnSpan={12}>
                                                <Card onClick={() => this.closeDetail()}>
                                                    <CardHeader title={"セキュリティイベント数"}/>
                                                    <CardBody>
                                                        <LineChart
                                                            style={{height: "120px" }}
                                                            data={entry[1].SecurityEvents ? Object.values(entry[1].SecurityEvents) :[]} fullWidth />
                                                    </CardBody>
                                                </Card>
                                            </GridItem>
                                        </Grid>                                        <Grid
                                            spacingType={[
                                                Grid.SPACING_TYPE.MEDIUM,
                                                Grid.SPACING_TYPE.NONE
                                            ]}
                                        >
                                            <GridItem columnSpan={6}>
                                                <Card onClick={() => this.closeDetail()}>
                                                    <CardHeader title={"成功リクエスト数"}/>
                                                    <CardBody>
                                                        <LineChart
                                                            style={{height: "180px" }}
                                                            data={Object.entries(entry[1].Success.Throughput).map(e=>this.buildTimeSeries(e[0], e[1], "COUNT"))} fullWidth />
                                                    </CardBody>
                                                </Card>
                                            </GridItem>
                                            <GridItem columnSpan={6}>
                                                <Card onClick={() => this.closeDetail()}>
                                                    <CardHeader title={"パフォーマンス"}/>
                                                    <CardBody>
                                                        <LineChart
                                                            style={{height: "180px" }}
                                                            data={Object.entries(entry[1].Success.Performance).map(e=>this.buildTimeSeries(e[0], e[1], "SECOND"))} fullWidth />
                                                    </CardBody>
                                                </Card>
                                            </GridItem>
                                        </Grid>
                                        <Grid
                                            spacingType={[
                                                Grid.SPACING_TYPE.MEDIUM,
                                                Grid.SPACING_TYPE.NONE
                                            ]}
                                        >
                                            <GridItem columnSpan={6}>
                                                <Card onClick={() => this.closeDetail()}>
                                                    <CardHeader title={"失敗リクエスト数"}/>
                                                    <CardBody>
                                                        <LineChart
                                                            style={{height: "180px" }}
                                                            data={Object.entries(entry[1].Success.Performance).map(e=>this.buildTimeSeries(e[0], e[1], "SECOND"))} fullWidth />
                                                    </CardBody>
                                                </Card>
                                            </GridItem>
                                            <GridItem columnSpan={6}>
                                                <Card onClick={() => this.closeDetail()}>
                                                    <CardHeader title={"利用率(CPU, Memory)"}/>
                                                    <CardBody>
                                                        <LineChart
                                                            style={{height: "180px" }}
                                                            data={entry[1].SystemSample ? Object.entries(entry[1].SystemSample).map(e=>this.buildTimeSeries(e[0], e[1], "PERCENT")) :[]} fullWidth />
                                                    </CardBody>
                                                </Card>
                                            </GridItem>
                                        </Grid>

                                    </div>)
                            })}
                        </ChartGroup>
                    <Stack
                        horizontalType={Stack.HORIZONTAL_TYPE.FILL_EVENLY}
                        directionType={Stack.DIRECTION_TYPE.VERTICAL}
                        fullWidth={true}>
                        <ChartGroup>
                            {false && data[0] && (
                            <StackItem key={`infrastack_status`} grow>
                                <Card onClick={() => this.closeDetail()}>
                                    <CardHeader title={`HTTP Status Code`}/>
                                    <CardBody>
                                        <AreaChart
                                            key={`infraline_status`}
                                            style={{height: "120px"}}
                                            data={data[0]}
                                            fullWidth
                                        />
                                    </CardBody>
                                </Card>
                            </StackItem>
                            )}
                            {data[1] && data[1].filter(item=>item[0]!='undefined').map((item, idx) => {
                            return (
                                <StackItem key={`infrastack_${idx}`}>
                                <Card onClick={() => this.closeDetail()}>
                                    <CardHeader title={item[0]}/>
                                    <CardBody>
                                        <AreaChart
                                            key={`infraline_${idx}`}
                                            style={{height: "120px"}}
                                            data={item[1]}
                                            fullWidth
                                        />
                                    </CardBody>
                                </Card>
                                </StackItem>
                            )
                        })}
                        </ChartGroup>
                    </Stack>
                    </>
                )
            }}
        </PlatformStateContext.Consumer>)
    }
}
