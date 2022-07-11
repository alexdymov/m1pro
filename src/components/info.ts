import Vue, { ComponentOptions } from 'vue';
import { debug } from '../util/debug';
import '../style/info.less';
import logo from '../../assets/images/icon128.png';
import hist from '../../CHANGELOG.md';
import MainState from './main-state';
import merge from 'lodash/merge';

const opts: ComponentOptions<Vue> = {
    template: `
    <div class="Info">
        <dialog-close></dialog-close>
        <div class="Info-wrap">
            <div class="Info-pages">
                <div class="Info-btn-main" :class='{selected: !showPro}'></div>
                <div class="Info-btn-pro" :class='{selected: showPro}'><div class="badge">1</div></div>
            </div>
            <div class="Info-content">
                <div class="Info-main" :class='{selected: !showPro}'></div>
                <div class="Info-pro" :class='{selected: showPro}'>
                    <div class="Info-pro-head">Текущая версия: ${VERSION}</div>
                    <div class="Info-pro-general">
                            <div class="_community">
                                Сообщество для обсуждения: 
                                <a href="https://discord.gg/YFzfEBcCKA" rel="nofollow" class="btn">
                                    <img src="https://camo.githubusercontent.com/f57032cdfa9884f57d69ede973b7c876a17afe1519b0aa271e06299651afbf81/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f446973636f72642d3732383944413f7374796c653d666c6174266c6f676f3d646973636f7264266c6f676f436f6c6f723d7768697465" alt="Discord" data-canonical-src="https://img.shields.io/badge/Discord-7289DA?style=flat&amp;logo=discord&amp;logoColor=white" style="max-width: 100%;">
                                </a>
                                <a target="_blank" rel="noopener noreferrer" class="btn" href="https://camo.githubusercontent.com/3f29b62bfbf1a9947a11107ca4aa6296fb2b35acde2a1896019f60194a1292d4/68747470733a2f2f696d672e736869656c64732e696f2f646973636f72642f393637343131323132333639343136313932">
                                    <img src="https://camo.githubusercontent.com/3f29b62bfbf1a9947a11107ca4aa6296fb2b35acde2a1896019f60194a1292d4/68747470733a2f2f696d672e736869656c64732e696f2f646973636f72642f393637343131323132333639343136313932" alt="Online" data-canonical-src="https://img.shields.io/discord/967411212369416192" style="max-width: 100%;">
                                </a>
                            </div>
                            <div>Заполните <a href="https://forms.gle/NpdZwJaUK4fjPJGa9">форму обратной связи</a> чтобы внести свой вклад в развитие проекта</div>
                    </div>
                    <div class="Info-pro-donations">
                        <h2>Пожертвования</h2>
                        <div>
                            <div class="form form-horizontal form-small">
                                <div class="title title-5">Paypal</div>
                                <div>
                                    <form action="https://www.paypal.com/donate" method="post" target="_blank">
                                        <input type="hidden" name="hosted_button_id" value="DQBQJ5UQEHD3W" />
                                        <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" border="0" name="submit" title="PayPal - The safer, easier way to pay online!" alt="Donate with PayPal button" />
                                        <img alt="" border="0" src="https://www.paypal.com/en_US/i/scr/pixel.gif" width="1" height="1" />
                                    </form>
                                </div>
                            </div>
                            <div class="form form-horizontal form-small">
                                <div class="title title-5">YooMoney</div>
                                <form method="POST" action="https://yoomoney.ru/quickpay/confirm.xml" target="_blank">
                                    <input type="hidden" name="receiver" value="410015004852328">
                                    <input type="hidden" name="quickpay-form" value="donate">
                                    <input type="hidden" name="targets" value="m1pro">
                                    <div class="form2-row yoo-controls">
                                        <input type="text" name="formcomment" placeholder="Комментарий">
                                        <input type="number" name="sum" value="500" data-type="number" max="15000">
                                        <label>
                                            <button type="button" class="button button-small" v-on:click='paymentType = "PC"' :class='{ _selected: paymentType === "PC" }'>
                                                <span class="yoo-icon yoo-icon-purse"></span>
                                            </button>
                                            <input type="radio" name="paymentType" value="PC" :checked='paymentType === "PC"'>
                                        </label>
                                        <label>
                                            <button type="button" class="button button-small" v-on:click='paymentType = "AC"' :class='{ _selected: paymentType === "AC" }'>
                                                <span class="yoo-icon yoo-icon-card"></span>
                                            </button>
                                            <input type="radio" name="paymentType" value="AC" :checked='paymentType === "AC"'>
                                        </label>
                                    </div>
                                    <div class="form2-row buttons">
                                        <input type="submit" class="button button-small" value="Donate">
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                    <div class="Info-pro-history">${hist}</div>
                </div>
            </div>
        </div>
    </div>`,
    data: function() {
        return {
            paymentType: 'PC'
        };
    },
    // computed: {
    //     paymentType: function () {
    //         debug('paymentType', jQuery('div.yoo-controls input[name="paymentType"]:checked').val())
    //         return jQuery('div.yoo-controls input[name="paymentType"]:checked').val() ?? "PC";
    //     }
    // },
    methods: {
        setPT: function (val) {
            $(`input[name=paymentType][value="${val}"]`).prop('checked', true);
        }
    },
    mounted() {
        const jq = jQuery(this.$el);
        const main = jq.find('div.Info-main');
        jQuery('div.footer div.container').children().each((i, el) => {
            main.append(jQuery(el).clone().removeClass('col-2 col-4'));
        });
        jq.find('div.Info-pages div').on('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            jq.find('div.selected').removeClass('selected');
            const cur = jQuery(e.delegateTarget);
            cur.addClass('selected');
            jQuery(cur.is('div.Info-btn-main') ? 'div.Info-main' : 'div.Info-pro').addClass('selected');
            cur.is('div.Info-btn-pro') && this.state.changeSeen();
        });
        jq.find('div.Info-btn-main').append(jQuery('a.header-logo svg').clone().attr('width', 128).attr('height', 128));
        this.state.$watch('lastSeen', () => {
            jq.find('div.badge').hide();
        });
        if (this.state.isUnseen(VERSION)) {
            jq.find('div.badge').show();
            jq.find('div.Info-pro-history h3 > strong').each((i, el) => {
                const jel = jQuery(el);
                if (this.state.isUnseen(jel.text())) {
                    jel.addClass('newver');
                }
            })
        }
        jq.find('div.Info-pro-history li > blockquote').each((i, el) => {
            const jel = jQuery(el);
            jel.before(jQuery('<a href="#">Подробнее</a>').on('click', () => jel.toggle()));
        });
        jq.find('div.Info-pro-history li strong').each((i, el) => {
            jQuery(el).replaceWith(() => `<span class="info-icon ${el.textContent}"/>`);
        });
    }
};

export default (state: MainState, showPro = false) => {
    const info = Vue.component('info', merge(opts, {
        mixins: [{
            created() {
                this.state = state;
                this.showPro = showPro;
            }
        }]
    }));
    (<any>info).raw_component = opts;
    return info;
};