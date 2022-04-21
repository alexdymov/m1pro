import { MarketLotThing, UserInfoLong, UserData, SocketData, SocketEvent, BanInfo, AsyncStorage } from './beans';

declare global {
    interface Window {
        onReadyToUse: (fn: any) => void
        tableResize: (v: boolean) => void
        require: {
            async: (src: string) => Promise<any>
        }
        _libs: {
            dialog: {
                show: (args: any) => Promise<any>
            }
        }
        _inventory_store_filter: {
            items: Array<MarketLotThing>
        }
        API: {
            websocket: { on: <T extends SocketData<any>>(e: string, fn: (data: T) => any) => any }
            user: UserInfoLong
            isUserSignedIn: () => boolean
            createAsyncStorage: (prm: { is_short: boolean }) => AsyncStorage
        }
        Table: {
            users_data: {
                [key: number]: UserData
            }
            GameAPI: {
                action: () => void
            }
            UI: {
                getUserColorById: (id: number) => string
            }
            getAssetsWorth: (e: any) => number
            getGameTime: () => number
        }
        Tools: {
            selectWordCase: (e: number, t: string[]) => any
        }
        PageNavigation: {
            openInNewTab: (url: string) => void
        }
        parsers: {
            numberToSpacedString: (val: number, delimiter: string) => string
            parseTimeToString: (val: number) => string
        }
    }

    interface Document {
        $on: (e: string, fn: any) => void;
    }

    interface JQuery {
        mnpl(attr: string): string;

        mnpl(attr: string, val: string): JQuery;
    }
}

export default {};