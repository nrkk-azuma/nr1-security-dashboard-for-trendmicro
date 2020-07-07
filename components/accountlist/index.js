import React from 'react';
import { NerdGraphQuery, Dropdown, DropdownItem, Spinner, UserStorageQuery, UserStorageMutation } from 'nr1';

// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction
export default class AccountList extends React.Component {

    constructor(props) {
        super(props);
        this._onChange = this.props.onChange;
        this.state = {data: [], title: this.props.title || 'Select Account'};
    }


    onChange(item) {
        UserStorageMutation.mutate({
            actionType: UserStorageMutation.ACTION_TYPE.WRITE_DOCUMENT,
            collection: 'trendmicromap',
            documentId: 'selectedAccount',
            document: {
                account: item
            },
        });
        this.setState({ title: item.name });
        this._onChange(item);
    }


    onRemove() {
        UserStorageMutation.mutate({
            actionType: UserStorageMutation.ACTION_TYPE.DELETE_DOCUMENT,
            collection: 'trendmicromap',
            documentId: 'selectedAccount'
        });
        this.setState({ title: null, data: [] });
    }

    render() {
        const {data, title} = this.state;

        if (data.length > 0) {
            return (
                <Dropdown title={title} items={data}>
                    {({item, index}) => (
                        <DropdownItem key={item.id} onClick={() => this.onChange(item)}>
                            {item.name} ({item.id})
                        </DropdownItem>
                    )}
                </Dropdown>
            );
        } else {
            return <Spinner/>
        }
    }
}
