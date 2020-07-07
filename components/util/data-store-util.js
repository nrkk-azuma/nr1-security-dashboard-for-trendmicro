import React from 'react';
import { UserStorageMutation, UserStorageQuery } from 'nr1';

// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction
export default class DataStoreUtil extends React.Component {
    static loadStoredDataSet() {
        return DataStoreUtil.loadAccount()
            .then(account => {
                if (!account) {
                    return { account: null, selectedEntities: [], securityMapData: []}
                }
                return Promise.all([
                    DataStoreUtil.loadEntities(account.id),
                    DataStoreUtil.loadNodeMap(account.id),
                ]).then(results => {
                    return {
                        account,
                        selectedEntities: results[0],
                        securityMapData: results[1]
                    };
                })
            });
    }

    static loadAccount() {
        return UserStorageQuery.query({
            collection: 'trendmicromap',
            documentId: 'selectedAccount',
        }).then(result => {
            return result.data ? result.data.account : null;
        });
    }

    static loadEntities(accountId) {
        return UserStorageQuery.query({
            collection: 'trendmicromap',
            documentId: `${accountId}:entities`,
        }).then(result => {
            return result.data ? result.data.entities : [];
        });
    }

    static loadNodeMap(accountId) {
        return UserStorageQuery.query({
            collection: 'trendmicromap',
            documentId: accountId + ':nodemap',
        }).then(result=>{
            return result.data ? result.data.mapData : null
        });
    }

    static storeAccount(account) {
        return UserStorageMutation.mutate({
            actionType: UserStorageMutation.ACTION_TYPE.WRITE_DOCUMENT,
            collection: 'trendmicromap',
            documentId: 'selectedAccount',
            document: {
                account
            }
        });
    }

    static storeEntities(accountId, entities) {
        return UserStorageMutation.mutate({
            actionType: UserStorageMutation.ACTION_TYPE.WRITE_DOCUMENT,
            collection: 'trendmicromap',
            documentId: `${accountId}:entities`,
            document: {
                entities
            },
        });
    }

    static removeAll() {
        UserStorageMutation.mutate({
            actionType: UserStorageMutation.ACTION_TYPE.DELETE_COLLECTION,
            collection: 'trendmicromap'
        });
    }
}
