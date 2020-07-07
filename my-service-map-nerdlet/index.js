import React from 'react';
import { Image, Sidebar, Segment } from 'semantic-ui-react';
import { UserStorageMutation, UserStorageQuery, NerdGraphQuery, NrqlQuery,
        navigation,
    Tabs, TabsItem,
    PlatformStateContext, Spinner, Checkbox, AutoSizer, BarChart,
    ScatterChart, LineChart, TableChart, PieChart, HeatmapChart,
    Card, CardHeader, CardBody, HeadingText, Grid, GridItem,
    Stack, StackItem, Modal, Button } from 'nr1';
import { Graph } from 'react-d3-graph';
import CalendarHeatmap from 'reactjs-calendar-heatmap'
import dsimage from '../img/ds.png';
import SecuritySummary from '../components/security-summary/security-summary.js';
import InstanceCorrelation from "../components/instance-correlation/instance-correlation";
import AccountList from '../components/accountlist';
import BaseSetting from '../components/base-setting/base-setting.js';
import DataStoreUtil from '../components/util/data-store-util';
import EntityList from './component/entitylist';
import createEngine, {
    DefaultLinkModel,
    DefaultNodeModel,
    DiagramModel
} from '@projectstorm/react-diagrams';

import {
    CanvasWidget
} from '@projectstorm/react-canvas-core';
import SecurityMap from "../components/security-map/security-map";
import {timeRangeToNrql} from "@newrelic/nr1-community";


// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction
export default class MyServiceMapNerdletNerdlet extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            afterOpenPage: true,
            account: null,
            securityMapData: null,
            logKey: '',
            appName: '',
            selectedEntities: [],
            timeRange: null,
            resetFlg: false,
            selectedTab: 'tab1'
        };
    }

    componentDidMount() {
        DataStoreUtil.loadStoredDataSet()
            .then(({account, selectedEntities, securityMapData}) => {
                this.state.afterOpenPage = false;
                this.setState({ account, selectedEntities, securityMapData, afterOpenPage: false });
            });
    }

    onChangeEntities(entities) {
        this.setState({ selectedEntities: entities});
    }

    onSettingLoaded(account) {
        DataStoreUtil.loadNodeMap(account.id)
            .then(securityMapData => {
                this.setState({ account, securityMapData });
            })
    }

    deepDive(logKey, appName, entityKey, hosts) {

        navigation.openStackedNerdlet({
            id: 'deep-dive-detail-nerdlet',
            urlState: {
                account: this.state.account,
                timeRange: this.state.timeRange,
                logKey, appName, entityKey, hosts
            }
        });
        //event.target.classList.add('rotate');
    }

    onReset() {
        this.state.account = null;
        this.state.securityMapData = null;
        this.state.selectedEntities = null;
        this.componentDidMount();
    }

    onChangeTab(selectedTab) {
        this.setState({ selectedTab })
    }

    render() {
        return (<PlatformStateContext.Consumer>
            {(platformStateContext) => {
                const {duration, begin_time, end_time} = platformStateContext.timeRange;
                const newSince = timeRangeToNrql({timeRange: platformStateContext.timeRange});
                if (!this.state.timeRange || newSince != this.state.timeRange.since) {
                    this.state.timeRange = platformStateContext.timeRange
                    this.state.timeRange.since = newSince;
                    this.setState({});
                    return (<Spinner/>)
                }
                return (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0
                        }}
                    >
                        <BaseSetting
                          account={this.state.account}
                          afterOpenPage={this.state.afterOpenPage}
                          selectedEntities={this.state.selectedEntities}
                          onChange={(entities) => this.onChangeEntities(entities)}
                          onReset={() => this.onReset()}
                          onSettingLoaded={account => this.onSettingLoaded(account)}
                        />
                        <Tabs onChange={(val)=>this.onChangeTab(val)}>
                            <TabsItem value="tab1" label="セキュリティサービスマップ">
                                <Grid
                                    style={{height: '100%'}}
                                >
                                    <GridItem columnSpan={12}>
                                        <Grid>
                                            <GridItem columnSpan={12}>
                                                <>
                                                    {this.state.account && (
                                                        <SecuritySummary accountId={this.state.account.id}/>)}
                                                </>
                                            </GridItem>
                                        </Grid>
                                        <Grid
                                            spacingType={[
                                                Grid.SPACING_TYPE.MEDIUM,
                                                Grid.SPACING_TYPE.NONE
                                            ]}
                                        >
                                            <GridItem columnSpan={12}>
                                                <>
                                                    {
                                                        this.state.account &&
                                                        this.state.selectedEntities.length > 0 &&
                                                        this.state.timeRange &&
                                                        this.state.selectedTab == 'tab1' &&
                                                        (<SecurityMap
                                                            accountId={this.state.account.id}
                                                            securityMapData={this.state.securityMapData}
                                                            selectedEntities={this.state.selectedEntities}
                                                            timeRange={this.state.timeRange}
                                                            onNodeClick={(logKeys, appName, entityKey, hosts) => this.deepDive(logKeys, appName, entityKey, hosts)}
                                                        />)}
                                                </>
                                            </GridItem>
                                        </Grid>
                                    </GridItem>
                                </Grid>
                            </TabsItem>
                            {false &&(
                            <TabsItem  value="tab2" label="セキュリティ発生状況(ホスト毎)">
                                <Grid
                                    style={{height: '100%'}}
                                >
                                    {this.state.account && this.state.selectedTab == 'tab2'&& (
                                    <GridItem
                                        className={'overflow'}
                                        style={{height: '100%'}}
                                        columnSpan={12}>
                                        <Grid>
                                            <GridItem columnSpan={12}>
                                                <>
                                                    {this.state.account && (
                                                        <InstanceCorrelation
                                                            accountId={this.state.account.id}
                                                            timeRange={this.state.timeRange}
                                                            selectedEntities={this.state.selectedEntities}
                                                        />)}
                                                </>
                                            </GridItem>
                                        </Grid>
                                    </GridItem>
                                )}
                                </Grid>
                            </TabsItem>)}
                        </Tabs>
                    </div>
                )
            }}
        </ PlatformStateContext.Consumer>)
    }
}
