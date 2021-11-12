import Vue from 'vue';
import mutator from '../../util/mutator';
import { debug } from '../../util/debug';

export class Chat {
    private ignored = new Array<String>();
    private jq: JQuery<Element>;
    private showIgnored = (localStorage.getItem('show_ignored') || '0') === '1';

    constructor(public base: Vue) {
        this.jq = jQuery(base.$el);
        this.init();
    }

    private init(): void {
        require('../../style/main/chat.less');
        this.ignored = JSON.parse(localStorage.getItem('ignored_users') || '[]');

        const chat = this.jq.find('div.GchatHistory');

        this.jq.find('div.Gchat-title-menu div.dropdown-list').prepend(jQuery(`
                <div class="dropdown-list-one _static">
                    <div class="form2-row">
                        <div class="form2-checkbox">
                            <input type="checkbox" class="switcher" id="gchat-opts-ignore"> <label for="gchat-opts-ignore">Показывать скрытые сообщения (<span class="gchat-ignored-count">0</span>)</label>
                        </div>
                    </div>
                </div>
            `).find('input').prop('checked', this.showIgnored).on('change', (e) => {
                this.showIgnored = e.delegateTarget.checked;
                localStorage.setItem('show_ignored', this.showIgnored ? '1' : '0');
                if (this.showIgnored) {
                    this.showAllChat(this.jq.find('div.GchatHistory'));
                } else {
                    this.handleAllChat(this.jq.find('div.GchatHistory'));
                }
            }).end()
        );

        if (chat.length) {
            this.handleAllChat(chat);
            mutator.mutateAdded(chat, jq => {
                if (jq.is('div.GchatHistory-one')) {
                    this.handleChatLine(jq);
                    this.updateCount();
                }
            });
        }
    }

    private showAllChat(chat: JQuery<Node>) {
        chat.find('.ignored').addClass('shown');
    }

    private handleAllChat(chat: JQuery<Node>) {
        chat.find('div.GchatHistory-one').each((i, el) => {
            this.handleChatLine(jQuery(el));
        });
        this.updateCount();
    }

    private updateCount() {
        const cnt = this.jq.find('div.ignored').length;
        debug(cnt)
        this.jq.find('div.Gchat-title-menu span.gchat-ignored-count').text(cnt);
    }

    private handleChatLine(jq: JQuery<Node>) {
        const meta = jq.find('div.GchatHistory-one-meta');
        if (!meta.is(':has(span._ignore)')) {
            meta.prepend(jQuery('<span class="_button _ignctrl _ignore ion-minus-circled" />').on('click', () => {
                this.ignoreUser(jq.data('userid'));
                this.handleAllChat(jq.parent());
            }));
        }
        if (!meta.is(':has(span._unignore)')) {
            meta.prepend(jQuery('<span class="_button _ignctrl _unignore ion-plus-circled" />').on('click', () => {
                this.unignoreUser(jq.data('userid'));
                this.handleAllChat(jq.parent());
            }));
        }

        const ignored = this.isUserIgnored(jq.data('userid'));
        this.checkMeta(meta, ignored);

        if (ignored) {
            jq.addClass('ignored');
            this.showIgnored && jq.addClass('shown') || jq.removeClass('shown');
        }
    }

    private checkMeta(meta: JQuery<HTMLElement>, ignored: boolean) {
        meta.find('span._ignore').css('display', !ignored ? 'unset' : 'none');
        meta.find('span._unignore').css('display', ignored ? 'unset' : 'none');
    }

    isUserIgnored(id: string) {
        return this.ignored.includes(id);
    }

    unignoreUser(id: string) {
        delete this.ignored[this.ignored.indexOf(id)];
        localStorage.setItem('ignored_users', JSON.stringify(this.ignored));
    }

    ignoreUser(id: string) {
        this.ignored.push(id);
        localStorage.setItem('ignored_users', JSON.stringify(this.ignored));
    }
}