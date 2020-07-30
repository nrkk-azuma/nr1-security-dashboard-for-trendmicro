import React from 'react';
import { Image, Sidebar, Segment } from 'semantic-ui-react';
import { UserStorageMutation, UserStorageQuery, NerdGraphQuery, NrqlQuery,
    navigation,
    Table, TableHeader, TableHeaderCell, TableRow, TableRowCell,
    PlatformStateContext, Spinner, Checkbox, AutoSizer, BarChart,
    ScatterChart, LineChart, TableChart, PieChart, HeatmapChart,
    Card, CardHeader, CardBody, HeadingText, Grid, GridItem,
    Stack, StackItem, Modal, Button } from 'nr1';
import { Graph } from 'react-d3-graph';
import { timeRangeToNrql } from '@newrelic/nr1-community';
import dsimage from '../../img/ds.png';
import DSLogQuery from '../util/ds-log-query';

// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction
export default class SecurityMap extends React.Component {

    ipPtn = /\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}/;

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
        this._onNodeClick = this.props.onNodeClick;
        this.state = {
            accountId: this.props.accountId,
            selectedEntities: this.props.selectedEntities,
            width: this.props.width,
            timeRange: this.props.timeRange,
            mapData: this.props.securityMapData || {nodes:[{id:'dummy'}], links: []},
            securityData: {},
            resetFlg: this.props.resetFlg,
            timer: null
        };

        this.detailChartsRef = React.createRef();
    }

    componentDidUpdate(prevProps) {
        if (this.props.accountId !== prevProps.accountId
          || this.props.selectedEntities.length !== prevProps.selectedEntities.length ||
          this.props.timeRange.since != this.state.timeRange.since
        ) {
            this.state.selectedEntities = this.props.selectedEntities;
            this.state.timeRange = this.props.timeRange;
            this.loadData();
        }
    }

    componentDidMount() {
        this.loadData();
    }

    loadData() {
        if (this.state.timer) {
            clearTimeout(this.state.timer);
        }
        this.loadSecurityData()
          .then(()=>{
              this.loadMapData();
          });
    }
    loadMapData() {

        const relationQuery = `
query ($ids: [EntityGuid]!) {
  actor {
    entities(guids: $ids) {
      relationships {
        source {
          accountId
          entity {
            guid
            name
            type
            domain
            entityType
          }
        }
        target {
          accountId
          entity {
            guid
            name
            type
            domain
            entityType
          }
        }
        type
      }
    }
  }
}
`;

        const {accountId, selectedEntities, timeRange, mapData} = this.state;
        if (!accountId) {
            return;
        }
        if (!selectedEntities || selectedEntities.length == 0) {
            return;
        }
        if (!timeRange) {
            return
        }

        const {nodes} = mapData;
        const {securityData} = this.state;
        const selectEntityMap = {};
        this.state.selectedEntities.forEach(entity => selectEntityMap['[' + entity.domain + ']' + entity.name] = entity);
        const variables = {ids: this.state.selectedEntities.map(data => data.guid)};
        return NerdGraphQuery.query({
            query: relationQuery,
            variables: variables
        }).then((result) => {
            const links = [];
            const nodeMap = {};
            const refNodeMap = {};
            nodes.forEach(node => (refNodeMap[node.id] = {entity: node}));
            const linkMap = {};
            links.forEach(link => linkMap[`${link.source}_${link.target}`] = link);
            result.data.actor.entities.map(entity => {
                entity.relationships
                  .map(result => {
                      var source = result.type == 'CALLS' ? result.source : result.target;
                      var target = result.type == 'CALLS' ? result.target : result.source;

                      const sourceKey = '[' + source.entity.domain + ']' + source.entity.name;
                      const targetKey = '[' + target.entity.domain + ']' + target.entity.name;

                      if (this.assertNodeDomain(source.entity.domain) && selectEntityMap[sourceKey]) {
                          nodeMap[sourceKey] = nodeMap[sourceKey] || source;
                          nodeMap[sourceKey].appName = source.entity.name;
                      } else {
                          delete nodeMap[sourceKey];
                          console.log(sourceKey);
                      }
                      if (this.assertNodeDomain(target.entity.domain) && selectEntityMap[targetKey]) {
                          nodeMap[targetKey] = nodeMap[targetKey] || target;
                          nodeMap[targetKey].appName = target.entity.name;
                      } else {
                          delete nodeMap[targetKey];
                      }
                      if (!linkMap[`${sourceKey}_${targetKey}`]
                        && nodeMap[sourceKey] && nodeMap[targetKey]) {
                          const link = {
                              "source": sourceKey,
                              "target": targetKey
                          };
                          links.push(link);
                          linkMap[`${link.source}_${link.target}`] = link;
                      }
                  })
            });
            const mapData = {
                nodes: Object.keys(nodeMap).map((k, idx) => {
                    const entity = nodeMap[k].entity;
                    var appName = nodeMap[k].appName;
                    var sdflg = entity.domain !== 'BROWSER' && securityData[appName] && securityData[appName].hasSecurityIssue;
                    var logKey = entity.domain !== 'BROWSER' && securityData[appName]
                      ? securityData[appName].logKeys.filter(k=>!!k).map(k=>k.name+'=\''+k.value+'\'').join(' OR ')
                      : '';
                    logKey
                    var hosts = securityData[appName].hosts;
                    var level = entity.domain !== 'BROWSER' && securityData[appName].level;
                    var stored = refNodeMap[k];
                    return {
                        id: k, label: entity.name,
                        x: (stored ? stored.entity.x : (idx + 1) * 30),
                        y: (stored ? stored.entity.y : (idx + 1) * 30),
                        domain: entity.domain, src: sdflg ? dsimage : '', hosts, logKey, appName, entityKey: logKey, level
                    }
                }),
                links
            };
            if (mapData.links.length > 0 || this.state.mapData.nodes[0].id== 'dummy') {
                this.state.mapData = mapData;
                this.setState({mapData});
            }
            this.state.timer = setTimeout(()=>this.loadData(), 10000);
        }).catch((error) => {
            console.log(error);
        });
    }

    loadSecurityData() {
        const { accountId, timeRange } = this.state;
        console.log("Load security information");
        console.log(this.state);
        if (!accountId) {
            return new Promise((res, rev)=>{rev()});
        }
        if (!timeRange) {
            return new Promise((res, rev)=>{rev()});
        }
        const { since } = timeRange;
        console.log("Loading security information");
        return Promise.all([
            NerdGraphQuery.query({
                query: this.nrql,
                variables: {
                    query: "FROM Transaction SELECT uniques(host) FACET appName " + since,
                    accountId
                }
            }),
            NerdGraphQuery.query({
                query: this.nrql,
                variables: {
                    query: "FROM Log SELECT count(*) FACET Hostname, dvchost WHERE " + DSLogQuery.logDangerCond + " " + since,
                    accountId
                }
            }),
            NerdGraphQuery.query({
                query: this.nrql,
                variables: {
                    query: "FROM Log SELECT count(*) FACET Hostname, dvchost WHERE " + DSLogQuery.logWarnCond + " " + since,
                    accountId
                }
            }),
            NrqlQuery.query({
                query: "SELECT uniques(entityName) FROM SystemSample FACET hostname,ec2PublicIpAddress " + since,
                accountId
            })
        ]).then((results) => {
            console.log("Loaded data use NRQL");
            console.log(results[0]);
            const { securityData } = this.state;
            const appHostMap = {};
            results[0].data.actor.account.nrql.results
              .forEach(record => appHostMap[record.facet] = record["uniques.host"])
            const hostLogCountMap = {};
            results[2].data.actor.account.nrql.results
              .forEach(log => hostLogCountMap[this.getIP(log.facet.join(','))] = {
                  count: log.count,
                  level: 1,
                  groups: [{name: 'Hostname', value: log.facet[0]}, {name: 'dvchost', value: log.facet[1]}]});
            results[1].data.actor.account.nrql.results
              .forEach(log => hostLogCountMap[this.getIP(log.facet.join(','))] = {
                  count: log.count,
                  level: 2,
                  groups: [{name: 'Hostname', value: log.facet[0]}, {name: 'dvchost', value: log.facet[1]}]});
            const privateIpInstanceIdMap = {};
            results[3].data.chart
              .forEach(sample => privateIpInstanceIdMap[sample.data[0].entityName] = sample.metadata.groups.filter(g=>g.type=='facet').map(g=>this.getIP(g.value)));
            Object.keys(appHostMap).map(appName => {
                var hosts = appHostMap[appName];
                var entityKeys = hosts.map(host => privateIpInstanceIdMap[host]).reduce((a,b)=>{a.push.apply(a,b);return a}, []);
                var securityIssues = entityKeys.map(key => hostLogCountMap[key]||0);
                var issueCount = securityIssues.filter(d=>d.count).map(d=>d.count).reduce((a,b)=>a+b, []);
                var logKeys = securityIssues.filter(d=>d.groups).map(d=>d.groups).reduce((a,b)=>{a.push.apply(a,b);return a}, []);
                var level = securityIssues.filter(d=>d.level).map(d=>d.level).reduce((a,b)=>a>b?a:b, 0);
                securityData[ appName ] = {
                    issueCount,
                    hasSecurityIssue: issueCount > 0,
                    hosts,
                    level,
                    logKeys
                };
            })
            console.log(this.state.securityData);
            return this.state.securityData;
        });
    }

    getIP(str) {
        if (this.ipPtn.test(str)) {
            return this.ipPtn.exec(str.replace('ec2',''))[0].replace(/-/g, '.');
        }
        if (str) {
            return str.replace(/(^,|,$)/, '');
        }
        return null;
    }

    assertNodeDomain(domain) {
        return !!domain && domain !== 'INFRA'
    }

    saveNodeState(nodeId, x, y) {
        const data = this.state.mapData;
        if (data.nodes.length == 0) {
            return;
        }
        const node = data.nodes.find(node => node.id == nodeId);
        if (!!node) {
            node.x = x;
            node.y = y
        }

        var storeData = JSON.parse(JSON.stringify(data));
        storeData.nodes.forEach(node => delete node.src);

        UserStorageMutation.mutate({
            actionType: UserStorageMutation.ACTION_TYPE.WRITE_DOCUMENT,
            collection: 'trendmicromap',
            documentId: this.state.accountId + ':nodemap',
            document: {
                mapData : storeData
            },
        });


    }

    deepDive(event, logKey, appName, entityKey, hosts) {
        //const entityGuid = 'MjY3MzgzNXxWSVp8REFTSEJPQVJEfDExNzU1Mzk';
        //navigation.openStackedEntity(entityGuid);
        this.setState({ });
        this.setState({ showDetails: true, logKey, appName, entityKey, deepDive: true, deepDiveHide: false, target: event.target}, () => {
            this.loadMapData();
        });
        //event.target.classList.add('rotate');
        this._onNodeClick(logKey, appName, entityKey, hosts);
    }

    render() {
        const {mapData} = this.state;

        let d3MapConfig = {
            staticGraph: false,
            staticGraphWithDragAndDrop: true,
            d3: {
                linkLength: 200
            },
            nodeHighlightBehavior: false, // if this is set to true reset positions doesn't work
            node: {
                color: 'lightgreen',
                size: 320,
                highlightStrokeColor: 'blue',
                fontSize: 16,
                highlightFontSize: 16,
                renderLabel: mapData.nodes[0].id != 'dummy',
                //labelProperty: node => cleanNodeId(node.id),
                viewGenerator: node => {
                    const img = (<div className='point' onClick={(e) => {
                        this.deepDive(e, node.logKey, node.appName, node.entityKey, node.hosts);
                    }}>
                        <div
                          className={'point circle ' + (node.level == 2 ? 'error' : node.level == 1 ? 'warning' : '')}></div>
                        {node.src && (<Image size='mini' src={node.src}/>)}
                    </div>);
                    if (node.id == 'dummy') {
                        return (<div></div>)
                    }
                    return img;
                }
            },
            link: {
                highlightColor: 'lightblue',
                type: 'CURVE_SMOOTH',
                renderLabel: true,
                fontColor: '#21ba45',
                fontSize: 13,
                fontWeight: 'bold',
                markerHeight: 10,
                markerWidth: 10
            },
            directed: true,
            width: this.state.width || 1200,
            height: 300,
        };
        return (
          <Card onClick={() => this.closeDetail()}><CardHeader
            title="Security Service Map"/>
              <CardBody>

                  <Graph
                    id="graphid" // id is mandatory, if no id is defined rd3g will throw an error
                    // ref="graph"
                    data={mapData}
                    config={d3MapConfig}
                    onNodePositionChange={(nodeId, x, y) => this.saveNodeState(nodeId, x, y)}
                  />
              </CardBody>
          </Card>
        )
    }
}
