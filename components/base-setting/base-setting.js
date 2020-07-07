import React from 'react';
import { UserStorageMutation, UserStorageQuery, NerdGraphQuery, NrqlQuery,
        navigation,
    Table, TableHeader, TableHeaderCell, TableRow, TableRowCell,
    Spinner, Dropdown, DropdownItem, BarChart,
    ScatterChart, LineChart, TableChart, PieChart, HeatmapChart,
    Card, CardHeader, CardBody, HeadingText, Grid, GridItem,
    Stack, StackItem, Modal, Button } from 'nr1';
import DataStoreUtil from '../util/data-store-util';

// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction
export default class BaseSetting extends React.Component {

    constructor(props) {
        super(props);
        this._onChange = this.props.onChange;
        this._onSettingLoaded = this.props.onSettingLoaded;
        this._onReset = this.props.onReset;
        this.state = {
            account: this.props.account,
            accountTitle: 'Select Account',
            accounts: [],
            entities: this.props.selectedEntities || null,
            allEntities: [],
            hidden: (!this.props.afterOpenPage && this.props.account) || true
        };
    }

    componentDidMount() {
        this.state.account && (this.state.accountTitle = this.state.account.name);
            this.loadAccounts().then(()=>{
            if (this.state.account) {
                return this.loadStoredEntities(this.state.account.id)
                    .then(() => {
                        this._onSettingLoaded(this.state.account);
                });
            } else {
                this.setState({});
            }
            return;
        })
    }
    loadStoredEntities(accountId) {

        return DataStoreUtil.loadEntities(accountId)
            .then(entities => {
            this.state.entities = entities || [];
            if (!this.state.hidden) {
                this.loadEntities(this.state.account.id);
            }
            this.state.entities && this.onChange(this.state.entities);
            return;
        });
    }

    assertNodeDomain(domain) {
        return !!domain && domain !== 'INFRA'
    }

    onSelectedAccount(item) {
        this.state.account = item;
        DataStoreUtil.storeAccount(item);
        this.state.accountTitle = item.name;
        this.loadStoredEntities(this.state.account.id);
    }

    saveEntityList() {
        DataStoreUtil.storeEntities(this.state.account.id, this.state.allEntities);
        this.setState({ hidden: true });
        this.onChange(this.state.allEntities);
        this._onSettingLoaded(this.state.account);
    }

    removeData(accountId) {
        return Promise.all([
            UserStorageMutation.mutate({
                actionType: UserStorageMutation.ACTION_TYPE.DELETE_DOCUMENT,
                collection: 'trendmicromap',
                documentId: `${accountId}:entities`,
            }),
            UserStorageMutation.mutate({
                actionType: UserStorageMutation.ACTION_TYPE.WRITE_DOCUMENT,
                collection: 'trendmicromap',
                documentId: 'selectedAccount'
            })
        ]).then(() => {
            this.setState({account: null, accountTitle: 'Select Account'});
        })
    }

    onChange(entities) {
        this._onChange(entities.filter(entity=>entity.selected));
    }

    onReset() {
        confirm('全ての設定が削除されます。よろしいですか？') && DataStoreUtil.removeAll()
            .then(()=>this._onReset());
    }


    loadAccounts() {
        const query1 = `
{
  actor {
    accounts {
      id
      name
    }
  }
}
`;
        return NerdGraphQuery.query({
            query: query1
        }).then((results) => {
            console.log(results);
            return results.data.actor.accounts.map(result => {
                return result;
            });
        }).then(accounts => {
            this.state.accounts = accounts;
        }).catch((error) => { console.log(error); });

    }

    loadEntities(accountId) {
        const query1 = `
query ($query: String!) {
  actor {
    entitySearch(query: $query) {
      count
      results {
        entities {
          name
          entityType
          guid
          domain
        }
      }
    }
  }
}
`;
        if (!accountId) {
            throw 'You should set accountId when you show this component';
        }
        NerdGraphQuery.query({
            query: query1,
            variables: {"query": "type IN (\'APPLICATION\') AND accountId=" + accountId}
        }).then(results => {
            var allEntities = results.data.actor.entitySearch.results.entities
                .filter(result => this.assertNodeDomain(result.domain))
                .map(result => {
                    var found = this.state.entities.find(e=>e.guid == result.guid);
                    result.selected = found && found.selected;
                    return result;
                });
            this.setState({ allEntities })
        }).catch((error) => {
            console.log(error);
        });
    }

    loadSecurityNodeMap(accountId) {
        return DataStoreUtil.loadNodeMap(accountId)
            .then(mapData => {
                this.state.securityMapData = mapData || {nodes: [], links: []};
            });
    }

    resetSecurityNodeMap(accountId) {
        this.state.mapData = {nodes:[{id:'dummy'}], links: []};
        return UserStorageMutation.mutate({
            actionType: UserStorageMutation.ACTION_TYPE.DELETE_DOCUMENT,
            collection: 'trendmicromap',
            documentId: accountId + ':nodemap'
        });
    }
    onClickSetting(selectedItem) {
        //this.setState({ mounted: true, hidden: false });
        this.state.hidden = false;
        if (this.state.account) {
            this.loadEntities(this.state.account.id);
        } else {
            this.setState({});
        }

    }

    componentDidUpdate(prevProps) {
        if (this.props.afterOpenPage !== prevProps.afterOpenPage
            && !this.props.account && !this.props.afterOpenPage
        ) {
            this.state.hidden = false;
            this.componentDidMount();
        }
        if (!!this.props.account && (!prevProps.account || this.props.account.id !== prevProps.account.id)) {
            this.state.account = this.props.account;
            this.componentDidMount();
        }
    }
    render() {
        const {
            allEntities, accountTitle, accounts, hidden
        } = this.state;

        return (
            <>
                <Button title="Add Entity" className="settingButton"
                        onClick={() => this.onClickSetting()}>設定</Button>
                <Modal
                    hidden={hidden}
                    onClose={() => {this.setState({hidden: true});}}>
                    {accounts.length > 0 && (
                        <>
                        <HeadingText type={HeadingText.TYPE.HEADING_1}>Step.1 アカウントを選択してください</HeadingText>
                        <Dropdown title={accountTitle} items={accounts}>
                            {({item, index}) => (
                                <DropdownItem key={item.id} onClick={() => this.onSelectedAccount(item)}>
                                    {item.name} ({item.id})
                                </DropdownItem>
                            )}
                        </Dropdown>
                        </>
                    )}
                    {allEntities && allEntities.length > 0 && (
                        <>
                        <HeadingText type={HeadingText.TYPE.HEADING_1}>Step.2 エンティティを選択して保存してください。</HeadingText>
                        <Table
                            items={allEntities}
                            selected={({item}) => item.selected}
                            onSelect={(evt, {item}) => (item.selected = evt.target.checked)}
                        >
                            <TableHeader>
                                <TableHeaderCell
                                    value={({item}) => item.domain}
                                    width="50%"
                                >
                                    Domain
                                </TableHeaderCell>
                                <TableHeaderCell
                                    value={({item}) => item.name}
                                    width="50%"
                                >
                                    Entity Name
                                </TableHeaderCell>
                            </TableHeader>

                            {({item}) => (
                                <TableRow>
                                    <TableRowCell>{item.domain}</TableRowCell>
                                    <TableRowCell>{item.name}</TableRowCell>
                                </TableRow>
                            )}
                        </Table>
                            <button onClick={() => this.saveEntityList()}>設定保存</button>
                        </>
                    )}
                    {this.state.account && allEntities && allEntities.length == 0 && (
                        <Spinner/>)}
                    <Button title="Add Entity" className="clearButton"
                            onClick={() => this.onReset()}>設定を削除する</Button>

                </Modal>
            </>
        )
    }
}
