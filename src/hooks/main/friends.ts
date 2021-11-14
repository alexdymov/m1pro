import Vue from 'vue';
import { FriendsData, FriendsGetReq, MResp, Presence, UserInfoShort } from '../../shared/beans';
import MainState from '../../components/main-state';

declare module 'vue/types/vue' {
    interface Vue {
        friends_all: { count: number, list: Array<UserInfoShort> }
    }
}

export class Friends {
    constructor(public base: Vue, private state: MainState) {
        require('../../style/main/friends.less');
        setInterval(() => {
            this.loadOnlineFriends().then(friends => {
                base.friends_all.count = friends.count;
                base.friends_all.list = friends.friends;
                /* base.friends_all.count += friends.count;
                friends.friends.forEach(fr => base.friends_all.list.push(fr)); */
            }, err => console.error(err));
        }, 10 * 1000);
    }

    private loadOnlineFriends(): JQuery.Promise<FriendsData> {
        return this.state.getFriends(new FriendsGetReq(Presence.Yes));
    }
}