import Vue from 'vue';
import MainState from '../../components/main-state';
import { debug } from '../../util/debug';

class Item {
    constructor(
        public href: string,
        public icon: string,
        public tooltip: string,
        public badger?: () => JQuery<HTMLElement>
    ) { }
}

export class HeaderMenu {
    private jq: JQuery<Element>;

    constructor(public base: Vue | { $el: HTMLElement }, private state: MainState) {
        this.jq = jQuery(base.$el).parent();
        this.init();
    }

    private init(): void {
        require('../../style/main/header.less');

        const signed = window.API.isUserSignedIn();
        const rightctr = this.jq.find('div.header-right');
        [
            new Item('/market', 'ion-ios-cart', 'Маркет', () => jQuery('<span class="badge" />').hide()),
            signed ? new Item('/friends', 'ion-ios-people', 'Друзья', () => this.findBadge('friends')) : [],
            signed ? new Item('/inventory', 'ion-bag', 'Инвентарь') : [],
            new Item('/m1tv', 'ion-monitor', 'M1TV', () => this.findBadge('m1tv')),
            new Item('/games', 'ion-ios-game-controller-b', 'Поиск игр'),
        ].flat().forEach(it => rightctr.prepend(this.newItem('header-right-one', it)));

        if (!signed) {
            setTimeout(() => {
                jQuery('.header-auth div.button').removeClass('button').removeClass('button-grass').text('').addClass('ion-log-in').addClass('header-user-one')
                    .parent().addClass('header-user-new').attr('kd-tooltip', 'Войти');
            }, 1);
        } else {
            const userctr = jQuery('<div class="header-user-new"/>').appendTo('.header > .widther');
            [
                new Item('/trades', 'ion-shuffle', 'Обмены', () => this.findBadge('inventory')),
                new Item('/wallet', 'ion-social-usd', 'Кошелек'),
                new Item('/settings', 'ion-gear-b', 'Настройки'),
                // new Item('/', 'ion-log-out', 'Выйти'),
            ].forEach(it => userctr.append(this.newItem('header-user-one', it)));
            // jQuery('<a class="HeaderUser-menu-user"><div class="HeaderUser-avatar" /></a>').attr('href', old.find('a:first').attr('href')).find('div').css('background-image', old.find('.HeaderUser-avatar').css('background-image')).end()
        }

        jQuery('.header-right-one._search').attr('kd-tooltip', 'Поиск игроков');
        jQuery('.header-right-one._im').attr('kd-tooltip', 'Чат');

        this.state.lots && this.showLots();
        this.state.$watch('lots', () => this.showLots());
    }

    private newItem(cls: string, it: Item): JQuery<HTMLElement> {
        const inner = jQuery(`<div class="${cls} ${it.icon}" kd-tooltip="${it.tooltip}" />`);
        if (it.badger) {
            inner.append(it.badger());
        }
        return jQuery(`<a href="${it.href}" class="header-link" />`).append(inner);
    }

    private showLots() {
        const badge = jQuery('.header-right .ion-ios-cart span.badge');
        if (this.state.lots.count) {
            badge.show().text(this.state.lots.count);
        } else {
            badge.hide();
        }
    }

    private findBadge(link: string): JQuery<HTMLElement> {
        return jQuery(`.header-menu a[href="/${link}"] span`).clone();
    }
}