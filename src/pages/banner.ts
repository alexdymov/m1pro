import info from '../components/info';
import MainState from '../components/main-state';

export default class Banner {
    constructor(private state: MainState) {
        if (localStorage.getItem('m1pro_banner_hidden') !== '1') {
            state.onCallMethod("execute.games", (v: any) => {
                this.init();
                return true;
            });
        }
    }

    private init() {
        require('../style/main/banner.less');
        const banner = jQuery('<div>').addClass('games-market-list-one _horizontal _m1pro').prependTo('div.games-market-list');
        // FIXME: the only fcking way to handle this is to return the correct index
        // $('.games-market-list-one').index() is called twice but we only need to fix index for the case where jquery init context of the is the banner's "button click", other's (right/left button clicks) context is "document"
        const oldidx = jQuery.fn.index;
        jQuery.fn.extend({
            index: function () {
                const idx = oldidx.call(this);
                if (this.hasClass('games-market-list-one') && jQuery(this.context).is('button')) {
                    return idx - 1;
                } else {
                    return idx;
                }
            }
        });
        banner.css('background-image', 'linear-gradient(162deg, rgb(0, 0, 0) 28%, rgb(220, 20, 60) 130%');
        const ctr = jQuery('<div>').addClass('_container').appendTo(banner);
        ctr.append(`
            <div class="games-market-list-one-text">
                <div class="games-market-list-one-text-title">Помощь M1Pro</div>
                <div class="games-market-list-one-text-text">
                    <div>Оставьте отзыв и оценку на странице расширения, вступите в сообщество для обсуждения, заполните форму обратной связи или пожертвуйте на развитие проекта!</div>
                </div>
            </div>
        `).append(`
            <div class="games-market-list-one-more">
                <div class="games-market-list-one-more-image"/>
                <div class="games-market-list-one-more-button-custom">
                    <button class="btn btn-white _show">Показать как</button>
                    <button class="btn btn-white _hide" style="display: none;">Убрать банер</button>
                </div>
            </div>
        `);
        const dot = jQuery('<div class="_m1pro"></div>').appendTo(".games-market-dots");
        const hideBtn = ctr.find('button._hide').on('click', () => {
            localStorage.setItem('m1pro_banner_hidden', '1');
            dot.remove();
            banner.remove();
            jQuery(".games-market-arrow").trigger("click");
        });
        ctr.find('button._show').on('click', () => {
            window.require("/js/dialog.js").showComponent(info(this.state, true));
            hideBtn.show();
        });
    }
}