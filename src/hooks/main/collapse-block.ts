import Vue from 'vue';

export class CollapseBlock {
    private opts = JSON.parse(localStorage.getItem('blocks') || '{}');

    constructor() {
        require('../../style/main/block.less');
    }

    add(base: Vue) {
        const jq = jQuery(base.$el);
        const btn = jQuery('<span class="block-hide" />');
        const cls = (<HTMLElement>jq.get(0)).className.replace(/block.*$/, '').trim();
        const clsCheck = (hide: boolean) => {
            btn.removeClass(!hide ? 'ion-ios-arrow-right' : 'ion-ios-arrow-down');
            btn.addClass(hide ? 'ion-ios-arrow-right' : 'ion-ios-arrow-down');
            if (hide) {
                jq.removeClass('_opened').addClass('_closed');
            } else {
                jq.addClass('_opened').removeClass('_closed');
            }
        };
        clsCheck(this.opts[cls]);
        btn.on('click', () => {
            this.opts[cls] = !this.opts[cls];
            clsCheck(this.opts[cls]);
            localStorage.setItem('blocks', JSON.stringify(this.opts));
        })
        jq.find('.title').append(btn);
    }
}