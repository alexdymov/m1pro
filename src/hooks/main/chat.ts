import Vue from 'vue';
import mutator from '../../util/mutator';

export class Chat {
    private ignored = new Array<String>();
    private jq: JQuery<Element>;

    constructor(public base: Vue) {
        this.jq = jQuery(base.$el);
        this.init();
    }

    private init(): void {
        require('../../style/main/chat.less');
        this.ignored = JSON.parse(localStorage.getItem('ignored_users') || '[]');

        const chat = this.jq.find('div.GchatHistory');
        if (chat.length) {
            this.handleAllChat(chat);
            mutator.mutateAdded(chat, jq => {
                if (jq.is('div.GchatHistory-one')) {
                    this.handleChatLine(jq);
                }
            });
        }
    }

    private handleAllChat(chat: JQuery<Node>) {
        chat.find('div.GchatHistory-one').each((i, el) => {
            this.handleChatLine(jQuery(el));
        });
    }

    private handleChatLine(jq: JQuery<Node>) {
        if (this.isUserIgnored(jq.data('userid'))) {
            jq.hide();
        } else {
            const meta = jq.find('div.GchatHistory-one-meta');
            if (!meta.is(':has(span._ignore)')) {
                meta.prepend(jQuery('<span class="_button _ignore ion-minus-circled" />').on('click', () => {
                    this.ignoreUser(jq.data('userid'));
                    this.handleAllChat(jq.parent());
                }));
            }
        }
    }

    isUserIgnored(id: string) {
        return this.ignored.includes(id);
    }

    ignoreUser(id: string) {
        this.ignored.push(id);
        localStorage.setItem('ignored_users', JSON.stringify(this.ignored));
    }
}