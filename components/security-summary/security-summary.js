import React from 'react';
import { NrqlQuery, NerdGraphQuery, PlatformStateContext, BarChart, AutoSizer,
    LineChart, StackedBarChart, Card, CardHeader, CardBody,
    Grid, GridItem } from 'nr1';
import { timeRangeToNrql } from '@newrelic/nr1-community';


export default class SecuritySummary extends React.Component {

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
    constructor(props) {
        super(props);
        if (!this.props.accountId) {
            throw "You should set accountId to use SecuritySummary";
        }
        this.state = {
            accountId: this.props.accountId,
            timeRange: {},
            data: [],
            timer: null
        };
    }

    componentDidMount() {

        if (this.state.timer) {
            clearTimeout(this.state.timer);
        }
        if (!this.state.timeRange.duration && !this.state.timeRange.begin_time) {
            return;
        }
        const since = timeRangeToNrql({timeRange: this.state.timeRange});
        NerdGraphQuery.query({
            query: this.nrql,
            variables: {
                query: "FROM Log SELECT count(*) FACET CASES(WHERE (EventType = 'AntiMalwareEvent' AND severity = '6') OR (EventType = 'WebReputationEvent' AND (severity in ('7','8'))) OR (EventType='IntrusionPreventionEvent' AND (severity in ('8','10'))) OR (EventType='IntegrityMonitoringEvent' AND (severity in ('8','10'))) OR (EventType='LogInspectionEvent' AND (severity in ('8','10'))) OR (EventType = 'ApplicationControlEvent' AND severity = '6' AND act = 'blocked') OR (EventType = 'SystemEvent' AND severity = '8') OR (EventType = 'FirewallEvent' AND repeatCount > 5 AND severity = '6') as 'Danger',  WHERE (EventType = 'WebReputationEvent' AND (severity in ('6'))) OR (EventType='IntrusionPreventionEvent' AND (severity in ('5','6'))) OR (EventType='IntegrityMonitoringEvent' AND (severity in ('6'))) OR (EventType='LogInspectionEvent' AND (severity in ('6'))) OR (EventType = 'ApplicationControlEvent' AND severity = '6' AND act = 'detectOnly') OR (EventType = 'SystemEvent' AND severity = '6') OR (EventType = 'FirewallEvent' AND repeatCount <= 5 AND severity = '5') as 'Warn') TIMESERIES " + since,
                accountId: this.state.accountId
            }
        }).then(result => result.data.actor.account.nrql.results).then(result => {
            var dataSet = {
                Danger: {
                    metadata: {
                        id: 'danger',
                        name: 'Danger',
                        color: '#d44e4e',
                        viz: 'main',
                        units_data: {
                            x: 'TIMESTAMP',
                            y: 'COUNT',
                        }
                    },
                    data: []
                },
                Warn: {
                    metadata: {
                        id: 'warn',
                        name: 'Warn',
                        color: '#d4be4e',
                        viz: 'main',
                        units_data: {
                            x: 'TIMESTAMP',
                            y: 'COUNT',
                        }
                    },
                    data: []
                }
            };
            result.forEach(d => {
                d.x = d.beginTimeSeconds*1000;
                d.y = d.count;
                dataSet[d.facet].data.push(d);
            });
            var barData = [
                {
                    metadata: {
                        id: 'danger',
                        name: 'Danger',
                        color: '#d44e4e',
                        viz: 'main',
                        units_data: {
                            y: 'COUNT',
                        }
                    },
                    data: [{y: dataSet.Danger.data.map(d => d.count).reduce((a, b) => a + b, 0)}]
                },
                {
                    metadata: {
                        id: 'warn',
                        name: 'Warn',
                        color: '#d4be4e',
                        viz: 'main',
                        units_data: {
                            y: 'COUNT',
                        }
                    },
                    data: [{y: dataSet.Warn.data.map(d => d.count).reduce((a, b) => a + b, 0)}],
                }];
            this.setState({data: [[dataSet.Danger, dataSet.Warn], barData]});
            this.state.timer = setTimeout(() => this.componentDidMount(), 10000);
        });

    }

    componentDidUpdate(prevProps, prevState) {
        const since0 = timeRangeToNrql({ timeRange: prevState.timeRange });
        const since1 = timeRangeToNrql({ timeRange: this.state.timeRange });

        if (since0 != since1) {
            this.componentDidMount();
        }
    }

    render() {
        const {data} = this.state;

        return (<PlatformStateContext.Consumer>
            {platformState => {
                const { duration, begin_time, end_time } = platformState.timeRange;
                if (duration && this.state.timeRange.duration !== duration ||
                    (begin_time && this.state.timeRange.begin_time !== begin_time) ||
                    (end_time && this.state.timeRange.end_time !== end_time) ) {
                    this.setState({ timeRange: platformState.timeRange});
                    return (<></>)
                }
                return (
                    <Grid
                        spacingType={[
                            Grid.SPACING_TYPE.NONE,
                            Grid.SPACING_TYPE.NONE
                                ]}
                    >
                        <GridItem columnSpan={6}>
                            <Card onClick={() => this.closeDetail()}><CardHeader title="トレンド"/>
                                <CardBody>
                                    <>
                                    {data[0]&& (
                                        <LineChart
                                            style={{height: "120px" }}
                                            data={data[0]}
                                            fullWidth
                                        />
                                    )}
                                    </>
                                </CardBody>
                            </Card>
                        </GridItem>
                        <GridItem columnSpan={6}>
                            <Card onClick={() => this.closeDetail()}><CardHeader title="重要度"/>
                                <CardBody>
                                    <>
                                    {data[1] && (
                                        <BarChart
                                            style={{height: "120px"}}
                                            data={data[1]}
                                            fullWidth
                                        />
                                    )}
                                    </>
                                </CardBody>
                            </Card>
                        </GridItem>
                    </Grid>
                )
            }}
        </PlatformStateContext.Consumer>)
    }
}
