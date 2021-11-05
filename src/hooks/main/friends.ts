import Vue from 'vue';
import { FriendsData, FriendsGetReq, MResp, Presence, UserInfoShort } from '../../shared/beans';

declare module 'vue/types/vue' {
    interface Vue {
        friends_all: { count: number, list: Array<UserInfoShort> }
    }
}

export class Friends {
    constructor(public base: Vue) {
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
        return $.post('/api/friends.get', new FriendsGetReq(Presence.Yes))
        .then((res: MResp<FriendsData>) => {
            const def = $.Deferred();
                if (res.code) {
                    return def.reject(res);
                } else {
                    return def.resolve(res.data);
                }
        });
    }
}