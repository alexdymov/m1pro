import Vue from 'vue';
import MainState from '../../components/main-state';
import { ItemData, ItemData2 } from '../../shared/beans';

declare module 'vue/types/vue' {
    interface Vue {
        item: ItemData & ItemData2
    }
}

export class Item {
    private jq: JQuery<Element>;

    constructor(public base: Vue, private state: MainState) {
        this.jq = jQuery(base.$el);
        base.item && this.init(base.item);
    }

    private init(item: ItemData & ItemData2): void {
        require('../../style/main/item.less');

        // debug(JSON.parse(JSON.stringify(item)));

        const mark = jQuery('<div class="_flex _mark ion-ios-cart"><span>...</span></div>');
        this.jq.find('div._left').find('div._mark.ion-ios-cart').remove().end().append(mark);
        this.base.$watch('item', it => {
            const id = it.item_proto_id ?? it.thing_prototype_id;
            this.state.getItemPrice(id)
                .then(price => {
                    if (price === null) {
                        mark.hide();
                    } else {
                        mark.css('display', 'flex').children().remove().end().append(`<span>${price}</span>`);
                    }
                })
                .fail(e => mark.css('color', '#da4553'));
            if (item.user_id === window.API.user.user_id) {
                this.state.lots.things.some(lot => {
                    if (lot.thing_prototype_id === id) {
                        mark.css('color', 'green');
                        return true;
                    }
                });
            }
        }, { immediate: true });
    }
}