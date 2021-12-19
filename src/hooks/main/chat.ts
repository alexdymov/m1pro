import Vue from 'vue';
import mutator from '../../util/mutator';
import { debug } from '../../util/debug';
import MainState from '../../components/main-state';

class IgnoredUser {
    constructor(public id?: string, public domain?: string) { }
}

export class Chat {
    private ignored = new Array<IgnoredUser>();
    private jq: JQuery<Element>;
    private showIgnored = (localStorage.getItem('show_ignored') || '0') === '1';

    constructor(public base: Vue, private state: MainState) {
        this.jq = jQuery(base.$el);
        this.init();
    }

    private init(): void {
        require('../../style/main/chat.less');
        const data: any[] = JSON.parse(localStorage.getItem('ignored_users') || '[]');

        const chat = this.jq.find('div.GchatHistory');

        this.jq.find('div.Gchat-title-menu div.dropdown-list').prepend(jQuery(`
                <div class="dropdown-list-one _static">
                    <div class="form2-row">
                        <div class="form2-checkbox">
                            <input type="checkbox" class="switcher" id="gchat-opts-ignore"> <label for="gchat-opts-ignore">Показывать скрытые сообщения (<span class="gchat-ignored-count">0</span>)</label>
                        </div>
                    </div>
                </div>
            `).find('input').prop('checked', this.showIgnored)
            .on('change', (e) => {
                this.showIgnored = e.delegateTarget.checked;
                localStorage.setItem('show_ignored', this.showIgnored ? '1' : '0');
                if (this.showIgnored) {
                    this.showAllChat(this.jq.find('div.GchatHistory'));
                } else {
                    this.handleAllChat(this.jq.find('div.GchatHistory'));
                }
            }).end()
        );

        this.convert(data).then(() => this.start(chat), err => console.error('failed to get users to convert', data, err));
    }

    private convert(data: any[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (data.length > 0 && typeof data[0] === 'string') {
                this.state.getUserInfo([], data).then(users => {
                    this.ignored = users.map(u => new IgnoredUser(`${u.user_id}`, u.domain));
                    this.save();
                    resolve();
                }).fail(reject);
            } else {
                this.ignored = data;
                resolve();
            }
        });
    }

    private start(chat: JQuery<HTMLElement>) {
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
        this.jq.find('div.Gchat-title-menu span.gchat-ignored-count').text(cnt);
    }

    private handleChatLine(jq: JQuery<Node>) {
        const meta = jq.find('div.GchatHistoryInfo');
        if (!meta.is(':has(span._ignore)')) {
            meta.prepend(jQuery('<span class="_button _ignctrl _ignore ion-minus-circled" />').on('click', () => {
                this.ignoreUser(this.getId(jq)).then(() => this.handleAllChat(jq.parent()), err => console.error('failed to get user data to ignore', jq, err));
            }));
        }
        if (!meta.is(':has(span._unignore)')) {
            meta.prepend(jQuery('<span class="_button _ignctrl _unignore ion-plus-circled" />').on('click', () => {
                this.unignoreUser(this.getId(jq));
                this.handleAllChat(jq.parent());
            }));
        }

        const ignored = this.isUserIgnored(this.getId(jq));
        this.checkMeta(meta, ignored);

        if (ignored) {
            jq.addClass('ignored');
            this.showIgnored && jq.addClass('shown') || jq.removeClass('shown');
        } else {
            jq.removeClass('ignored');
        }
    }

    private getId(jq: JQuery<Node>): string {
        const hrefId = new RegExp('^/profile/([^/]+)$');
        const href = jq.find('div.GchatHistoryUser > a').attr('href');
        return href.replace(hrefId, '$1');
    }

    private checkMeta(meta: JQuery<HTMLElement>, ignored: boolean) {
        meta.find('span._ignore').css('display', !ignored ? 'unset' : 'none');
        meta.find('span._unignore').css('display', ignored ? 'unset' : 'none');
    }

    isUserIgnored(id: string) {
        return this.ignored.findIndex(u => u.id === id || u.domain === id) >= 0;
    }

    unignoreUser(id: string) {
        const idx = this.ignored.findIndex(u => u.id === id || u.domain === id);
        if (idx >= 0) {
            this.ignored.splice(idx, 1);
            this.save();
        }
    }

    ignoreUser(id: string): Promise<void> {
        return new Promise((resolve, reject) => this.state.getUserInfo(id).then(users => {
            this.ignored.push(new IgnoredUser(`${users[0].user_id}`, users[0].domain));
            this.save();
            resolve();
        }).fail(reject));
    }

    private save() {
        localStorage.setItem('ignored_users', JSON.stringify(this.ignored));
    }
}