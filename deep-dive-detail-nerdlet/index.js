import React from 'react';
import DeepDiveDetail from './detail';
import { PlatformStateContext, NerdletStateContext } from 'nr1';

export default class Wrapper extends React.PureComponent {
    render() {
        return (
            <PlatformStateContext.Consumer>
                {platformUrlState => (
                    <NerdletStateContext.Consumer>
                        {nerdletUrlState => (
                            <DeepDiveDetail
                                platformUrlState={platformUrlState}
                                nerdletUrlState={nerdletUrlState}
                            />
                        )}
                    </NerdletStateContext.Consumer>
                )}
            </PlatformStateContext.Consumer>
        );
    }
}
