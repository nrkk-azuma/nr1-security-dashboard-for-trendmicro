import React from 'react';
import { NrqlQuery, PlatformStateContext, BarChart, AutoSizer,
    SparklineChart, ChartGroup, StackedBarChart, Card, CardHeader, CardBody,
    Icon, navigation } from 'nr1';
import { timeRangeToNrql } from '@newrelic/nr1-community';

export default class SecurityCard extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            title: this.props.title,
            src: this.props.src,
            logData: this.props.logData,
            logKey: this.props.logKey,
            account: this.props.account,
            rate: 0,
            otherDataSet: JSON.parse(JSON.stringify(this.props.otherDataSet))
        };
        this.calculateRate();
    }

    calculateRate() {
        Object.entries(this.state.otherDataSet).forEach(entry => this.state.otherDataSet[entry[0]].data=entry[1]);
        if (this.state.logData.length == 0) {
            return;
        }
        var logLength = this.state.logData.length;
        var logPeekMap = {};
        this.state.logData.filter(d => d.metadata.id.indexOf('event_') == 0)[0].data.forEach(data => {
            logPeekMap[data.x0] = 1;
        });

        var totalCount = 0;
        var totalHit = 0;
        Object.entries(this.state.otherDataSet).forEach(entry => {
            if (entry[1].data.length == 0) {
                return;
            }
            var subtotalhit = 0;
            var subtotalcount = 0;
            entry[1].data.filter(d => d.metadata.id.indexOf('event_') == 0).forEach(ed => {
                var peekMap = {};
                ed.data.forEach(d => {
                    peekMap[d.x0] = d;
                });
                var hit = Object.keys(logPeekMap).filter(lp => peekMap[lp]).length;
                var count = logLength + ed.data.length - hit;
                subtotalhit += hit;
                subtotalcount += count;
                totalHit += hit;
                totalCount += count;
                var rate = hit / count * 100;
                if (rate > 0) {
                    if (rate > 50) {
                        ed.metadata.color = 'red';
                    } else {
                        ed.metadata.color = '#fbc02d';
                    }
                }

            });
            this.state.otherDataSet[entry[0]].rate = subtotalcount == 0 ? 0: Math.round(subtotalhit / subtotalcount * 10000) / 100;
        });

        this.state.rate = totalCount == 0 ? 0 : Math.round(totalHit / totalCount * 10000) / 100;
    }

    componentDidMount() {

    }

    componentDidUpdate(prevProps, prevState) {
        const since0 = timeRangeToNrql({ timeRange: prevState.timeRange });
        const since1 = timeRangeToNrql({ timeRange: this.state.timeRange });

        if (since0 != since1) {
            this.componentDidMount();
        }
    }

    render() {
        const {title, src, logData, logKey, rate, otherDataSet, account} = this.state;

        return (<div className="SecurityCard">
            <ChartGroup>
                <div className="SecurityCard_outer">
                    <div className="SecurityCard_logbox">
                        <div className="SecurityCard_logdata">
                            <SparklineChart data={logData}/>
                        </div>
                        <div className="SecurityCard_logsubtitle">Peek time correlation rate</div>
                        {logData.length > 0 && (<div className="SecurityCard_lograte">{rate}%</div>)}
                        <div className="SecurityCard_logtitle">{title}</div>
                        <button className="logsButton" onClick={() => {
                            const nerdlet = {
                                id: 'logger.log-tailer',
                                urlState: {
                                    query: logKey,
                                    accountId: account.id
                                }
                            };

                            navigation.openStackedNerdlet(nerdlet);
                        }}><Icon type={Icon.TYPE.HARDWARE_AND_SOFTWARE__SOFTWARE__LOGS}/>See logs
                        </button>
                    </div>
                    <div className="SecurityCard_others">
                        {otherDataSet && Object.entries(otherDataSet).map((data, idx) => (
                            <div key={`other_${idx}`} className="SecurityCard_otherbox">
                                <div className="SecurityCard_otherdata">
                                    <SparklineChart data={data[1].data}/>
                                </div>
                                {logData.length > 0 && (<div className="SecurityCard_otherrate">{data[1].rate}%</div>)}
                                <div className="SecurityCard_othertitle">{data[0]}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </ChartGroup>
            <div className="SecurityCard_image">

            </div>
        </div>)
    }
}
