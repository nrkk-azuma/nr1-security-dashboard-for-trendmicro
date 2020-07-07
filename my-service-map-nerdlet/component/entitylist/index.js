import React from 'react';
import { NerdGraphQuery, Dropdown, DropdownItem, Spinner } from 'nr1';

// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction
export default class EntityList extends React.Component {

    constructor(props) {
        super(props);
        this._onChange = this.props.onChange;
        this.state = {data: [], title: 'Select Entity', accountId: props.accountId};
    }

    componentDidMount() {
        const query1 = `
query ($query: String!) {
  actor {
    entitySearch(query: $query) {
      results {
        entities {
          domain
          name
          guid
          entityType
          accountId
        }
      }
    }
  }
}

`;
        NerdGraphQuery.query({
            query: query1,
            variables: {"query": "type IN ('APPLICATION') AND accountId = "+ this.state.accountId }
        }).then((results) => {
            console.log(results);
            return results.data.actor.entitySearch.results.entities.map(result => {
                return result;
            });
        }).then(data => {
                this.setState({ data });
        }).catch((error) => { console.log(error); });

    }

    onChange(item) {
        this.setState({ title: item.name });
        this._onChange(item);
    }

            render() {
                const { data, title } = this.state;

                if (data.length > 0) {
                    return (
                        <Dropdown title={title} items={data} >
                            {({ item, index }) => (
                                <DropdownItem key={item.guid} onClick={()=>this.onChange(item)}>
                                    [{item.domain}] {item.name}
                                </DropdownItem>
                            )}
                        </Dropdown>
                    );
                } else {
                    return <Spinner/>
                }
            }
}
