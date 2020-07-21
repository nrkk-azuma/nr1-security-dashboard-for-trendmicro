import React from 'react';
import { Image, Sidebar, Segment } from 'semantic-ui-react';
import { NrqlQuery, navigation,
    Table, TableHeader, TableHeaderCell, TableRow, TableRowCell,
    PlatformStateContext, Spinner, Checkbox, AutoSizer, BarChart,
    ScatterChart, LineChart, TableChart, PieChart, HeatmapChart,
    Card, CardHeader, CardBody, HeadingText, Grid, GridItem,
    Stack, StackItem, Modal, Button } from 'nr1';
import { timeRangeToNrql } from '@newrelic/nr1-community';

import SecurityCard from "../components/security-card/security-card";
import DSLogQuery from "../components/util/ds-log-query";

import IMG_AhtiMalware from '../img/anti-malware.png';
import IMG_ApplicationControl from '../img/application-control.png';
import IMG_Integrity from '../img/integrity.png';
import IMG_Intrusion from '../img/intrusion.png';
import IMG_LogInspection from '../img/log-inspection.png';
import IMG_Reputation from '../img/reputation.png';
import IMG_Firewall from '../img/firewall.png';


// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction
export default class DeepDiveDetail extends React.Component {

    constructor(props) {
        super(props);
        console.log('deep-dive');
        const { platformUrlState, nerdletUrlState } = this.props;
        this.state = {
            account: nerdletUrlState.account,
            logKey: nerdletUrlState.logKey,
            hosts: nerdletUrlState.hosts,
            appName: nerdletUrlState.appName,
            entityKey: nerdletUrlState.entityKey,
            since: timeRangeToNrql({ timeRange: nerdletUrlState.timeRange }),
            timeRange: nerdletUrlState.timeRange,
            deepDiveCorrelated: {},
            timer: null
        };
    }

    componentDidMount() {
        this.loadData();
    }
    loadData() {
        if (this.state.timer) {
            clearTimeout(this.state.timer);
        }
        console.log('deep-dive');
        if (!this.state.account) {
            return;
        }
        if (!this.state.timeRange) {
            return;
        }
        const { timeRange, since } = this.state;
        var startTime = timeRange.duration ? (new Date().getTime() - timeRange.duration) : timeRange.begin_time;
        Promise.all([
            NrqlQuery.query({
                query: "FROM Log Select count(*) FACET EventType TIMESERIES WHERE ((" + DSLogQuery.logDangerCond + ") OR (" + DSLogQuery.logWarnCond + ")) AND (" + this.state.logKey + ") " + since,
                accountId: this.state.account.id
            }).then((result) => {
                var dataSet = {
                    "AntiMalwareEvent": [],
                    "LogInspectionEvent": [],
                    "IntegrityEvent": [],
                    "PayloadLog": [],
                    "AppControlEvent": [],
                    "WebReputationEvent": [],
                    "FirewallEvent": [],
                    "SystemEvent": []
                };
                result.data.chart.forEach(data => {
                    var eventType = data.metadata.groups.find(d=>d.name=='EventType').value;
                    dataSet[eventType] = this.convertTimeHeat([data], startTime);
                })
                return dataSet;
            }),
            NrqlQuery.query({
                query: "FROM Transaction SELECT count(*) TIMESERIES FACET http.statusCode WHERE http.statusCode LIKE '40%' OR http.statusCode LIKE '50%' WHERE appName='" + this.state.appName + "' " + since,
                accountId: this.state.account.id
            }).then((result) => {
                return this.convertTimeHeat(result.data.chart, startTime);
            }),

            NrqlQuery.query({
                query: "FROM Transaction SELECT percentile(duration, 95) TIMESERIES FACET appName WHERE appName='" + this.state.appName + "' " + since,
                accountId: this.state.account.id
            }).then((result) => {
                return this.convertTimeHeat(result.data.chart, startTime);
            }),
            NrqlQuery.query({
                query: "FROM SystemSample SELECT max(cpuPercent) as 'CPU usage(%)', max(memoryUsedBytes/1000000000) as 'Memory usage(GB)' TIMESERIES FACET entityName WHERE entityName in (" + this.state.hosts.map(d=>"'"+d+"'").join(',') + ") " + since,
                accountId: this.state.account.id
            }).then((result) => {
                return this.convertTimeHeat(result.data.chart, startTime);
            }),
            NrqlQuery.query({
                query: "FROM ProcessSample SELECT stddev(memoryResidentSizeBytes) FACET processDisplayName, entityName TIMESERIES WHERE entityName in (" + this.state.hosts.map(d=>"'"+d+"'").join(',') + ") " + since,
                accountId: this.state.account.id
            }).then((result) => {
                return this.convertTimeHeat(result.data.chart, startTime);
            })
        ]).then((result) => {
            this.setState({
                deepDiveCorrelated: {
                    dataset: result[0],
                    TransactionError: result[1],
                    TransactionPerformance: result[2],
                    CpuMemory: result[3],
                    Process: result[4]
                }
            });
            this.state.timer = setTimeout(()=> this.loadData(), 30000);
        });
    }

    heatMapColorforValue(value){
        var h = (1.0 - value) * 240
        return "hsl(" + h + ", 100%, 50%)";
    }
    convertTimeHeat(data, startTime) {
        var width = Math.ceil(this.state.timeRange.duration / 60);
        if (width > 3600000) {
            width = 3600000;
        }
        var s = startTime;
        var compositeRes = [];
        data.forEach(facet => {
            compositeRes.push(facet);
            const name = facet.metadata.name;
            var max = facet.data.map(d => d.y).reduce((a, b) => (b = a > b ? a : b));
            var ave = facet.data.map(d => d.y).reduce((a, b) => a + b)/facet.data.length;
            var stddev = Math.sqrt(facet.data.map(d=>Math.pow(d.y-ave,2)).reduce((a,b)=>a+b)/facet.data.length, 2);

            if ( stddev / ave < .5) {
                return;
            }
            var res = {};
            for (var s = startTime; s < startTime + this.state.duration; s += width) {
                res[`time_${s}`] = [];
            }
            facet.data.forEach(data => {
                var idx = Math.floor((data.x - startTime) / width) * width + startTime;
                res[`time_${idx}`] = res[`time_${idx}`] || [];
                res[`time_${idx}`].push({ dev: 10*(data.y-ave)/stddev+50, data: data.y });
            });
            var test = [];
            Object.keys(res).filter(key => res[key].length > 0).forEach(key => {
                var start = parseInt(key.slice(5));
                var datas = res[key];
                var areaMaxDev = datas.map(d=>d.dev).reduce((a, b) => (b = a > b ? a : b))
                var areaMaxData = datas.map(d=>d.data).reduce((a, b) => (b = a > b ? a : b))
                if (70 <= areaMaxDev && (areaMaxData / max) >= .5 ) {
                    test.push({x0: start, x1: start + width-1})
                }
            })
            test.length > 0 && compositeRes.push({
                metadata: {
                    id: `event_${name}`,
                    name: name,
                    color: "gray",
                    viz: 'event',
                    units_data: {
                        x: 'TIMESTAMP',
                        y: 'BYTES',
                    }
                },
                data: test
            });
        });


            return compositeRes;
    }

    render() {
        const {
            appName, entityKey, account, since,
            applications, deepDiveCorrelated
        } = this.state;
        const logKey = this.state.logKey.replace(/=/g, ':').replace(/'/g, '"');
        var hosts = this.state.hosts.map(d => "'" + d + "'").join(',')
        const {TransactionError, TransactionPerformance, CpuMemory, Process} = deepDiveCorrelated;
        const otherData = {TransactionError, TransactionPerformance, CpuMemory, Process};
        console.log('deep-dive');
        return (
            <div className={"deep-dive-detail"}>
                <HeadingText type={HeadingText.TYPE.HEADING_2}>イベント発生相関({appName})</HeadingText>
                {deepDiveCorrelated.dataset && (
                    <>
                        <Grid
                            spacingType={[
                                Grid.SPACING_TYPE.MEDIUM,
                                Grid.SPACING_TYPE.NONE
                            ]}
                        >
                            <GridItem columnSpan={3}>
                                <SecurityCard
                                    key="AntiMalwareEvent"
                                    title="不正プログラム対策"
                                    src={IMG_AhtiMalware}
                                    logData={deepDiveCorrelated.dataset.AntiMalwareEvent}
                                    logKey={'entity.name:"' + appName + '" OR (' + logKey + ' EventType:"AntiMalwareEvent")'}
                                    account={account}
                                    otherDataSet={otherData}/>
                            </GridItem>
                            <GridItem columnSpan={3}>
                                <SecurityCard
                                    key="LogInspectionEvent"
                                    title="セキュリティログ監視"
                                    src={IMG_LogInspection}
                                    logData={deepDiveCorrelated.dataset.LogInspectionEvent}
                                    logKey={'entity.name:"' + appName + '" OR (' + logKey + ' EventType:"LogInspectionEvent")'}
                                    account={account}
                                    otherDataSet={otherData}/>
                            </GridItem>
                            <GridItem columnSpan={3}>
                                <SecurityCard
                                    key="IntegrityEvent"
                                    title="変更監視"
                                    src={IMG_Integrity}
                                    logData={deepDiveCorrelated.dataset.IntegrityEvent}
                                    logKey={'entity.name:"' + appName + '" OR (' + logKey + ' EventType:"IntegrityEvent")'}
                                    account={account}
                                    otherDataSet={otherData}/>
                            </GridItem>
                            <GridItem columnSpan={3}>
                                <SecurityCard
                                    key="PayloadLog"
                                    title="侵入防御"
                                    src={IMG_Intrusion}
                                    logData={deepDiveCorrelated.dataset.PayloadLog}
                                    logKey={'entity.name:"' + appName + '" OR (' + logKey + ' EventType:"PayloadLog")'}
                                    account={account}
                                    otherDataSet={otherData}/>
                            </GridItem>
                        </Grid>
                        <Grid
                            spacingType={[
                                Grid.SPACING_TYPE.MEDIUM,
                                Grid.SPACING_TYPE.NONE
                            ]}
                        >
                            <GridItem columnSpan={3}>
                                <SecurityCard
                                    key="AppControlEvent"
                                    title="アプリケーション操作"
                                    src={IMG_ApplicationControl}
                                    logData={deepDiveCorrelated.dataset.AppControlEvent}
                                    logKey={'entity.name:"' + appName + '" OR (' + logKey + ' EventType:"AppControlEvent")'}
                                    account={account}
                                    otherDataSet={otherData}/>
                            </GridItem>
                            <GridItem columnSpan={3}>
                                <SecurityCard
                                    key="WebReputationEvent"
                                    title="Webリクエスト遮断"
                                    src={IMG_Reputation}
                                    logData={deepDiveCorrelated.dataset.WebReputationEvent}
                                    logKey={'entity.name:"' + appName + '" OR (' + logKey + ' EventType:"WebReputationEvent")'}
                                    account={account}
                                    otherDataSet={otherData}/>
                            </GridItem>
                            <GridItem columnSpan={3}>
                                <SecurityCard
                                    key="FirewallEvent"
                                    title="ファイアウォール"
                                    src={IMG_Firewall}
                                    logData={deepDiveCorrelated.dataset.FirewallEvent}
                                    logKey={'entity.name:"' + appName + '" OR (' + logKey + ' EventType:"FirewallEvent")'}
                                    account={account}
                                    otherDataSet={otherData}/>
                            </GridItem>
                            <GridItem columnSpan={3}>
                                <SecurityCard
                                    key="SystemEvent"
                                    title="システムログ"
                                    src={IMG_AhtiMalware}
                                    logData={deepDiveCorrelated.dataset.SystemEvent}
                                    logKey={'entity.name:"' + appName + '" OR (' + logKey + ' EventType:"SystemEvent")'}
                                    account={account}
                                    otherDataSet={otherData}/>
                            </GridItem>
                        </Grid>
                        <HeadingText type={HeadingText.TYPE.HEADING_2}>リクエスト</HeadingText>
                        <Grid>
                            <GridItem columnSpan={6}>
                                <Card onClick={() => this.closeDetail()}><CardHeader
                                    title="アクセス数"/>
                                    <CardBody>
                                        <LineChart
                                            accountId={this.state.account.id}
                                            query={"FROM Transaction SELECT count(*) TIMESERIES FACET name WHERE appName='" + appName + "' " + since}
                                            fullWidth
                                        />
                                    </CardBody>
                                </Card>
                            </GridItem>
                            <GridItem columnSpan={6}>
                                <Card onClick={() => this.closeDetail()}><CardHeader
                                    title="応答速度(p. 95)"/>
                                    <CardBody>
                                        <LineChart
                                            accountId={this.state.account.id}
                                            query={"FROM Transaction SELECT percentile(duration, 95) TIMESERIES FACET name WHERE appName='" + appName + "' " + since}
                                            fullWidth
                                        />
                                    </CardBody>
                                </Card>
                            </GridItem>

                        </Grid>
                        <HeadingText type={HeadingText.TYPE.HEADING_2}>インフラ</HeadingText>
                        <Grid>
                            <GridItem columnSpan={6}>
                                <Card onClick={() => this.closeDetail()}><CardHeader
                                    title="CPU/Memory"/>
                                    <CardBody>
                                        <LineChart
                                            accountId={this.state.account.id}
                                            query={"FROM SystemSample SELECT max(cpuPercent) as 'CPU usage(%)', max(memoryUsedBytes/1000000000) as 'Memory usage(GB)' TIMESERIES FACET entityName WHERE entityName in (" + hosts + ") " + since}
                                            fullWidth
                                        />
                                    </CardBody>
                                </Card>
                            </GridItem>
                            <GridItem columnSpan={6}>
                                <Card onClick={() => this.closeDetail()}><CardHeader
                                    title="プロセス(メモリ偏差)"/>
                                    <CardBody>
                                        <LineChart
                                            accountId={this.state.account.id}
                                            query={"FROM ProcessSample SELECT stddev(memoryResidentSizeBytes) TIMESERIES FACET processDisplayName, entityName WHERE entityName in (" + hosts + ") " + since}
                                            fullWidth
                                        />
                                    </CardBody>
                                </Card>
                            </GridItem>

                        </Grid>
                    </>
                )}
                {!deepDiveCorrelated.dataset && (
                    <Spinner/>
                )}
            </div>
        )
    }
}
