import Vue, { ComponentOptions } from 'vue';
import { debug } from '../util/debug';
import '../style/info.less';
import logo from '../../assets/images/icon128.png';
// import hist from '../../CHANGELOG.md';

const opts: ComponentOptions<Vue> = {
    template: `
    <div class="Info">
        <dialog-close></dialog-close>
        <div class="Info-wrap">
            <div class="Info-pages">
                <div class="Info-page-orig selected"></div>
                <div class="Info-page-pro"></div>
            </div>
            <div class="Info-content">
                <div class="Info-main selected"></div>
                <div class="Info-pro">$hist}</div>
            </div>
        </div>
    </div>`,
    mounted() {
        const jq = jQuery(this.$el);
        const main = jq.find('div.Info-main');
        jQuery('div.footer div.container').children().each((i, el) => {
            main.append(jQuery(el).clone().removeClass('col-2 col-4'));
        });
        jq.find('div.Info-pages div').on('click', (e) => {
            jq.find('div.selected').removeClass('selected');
            const cur = jQuery(e.delegateTarget);
            cur.addClass('selected');
            jQuery(cur.is('div.Info-page-orig') ? 'div.Info-main' : 'div.Info-pro').addClass('selected');
        });
        jq.find('div.Info-page-orig').append(jQuery('a.header-logo svg').clone().attr('width', 128).attr('height', 128));
        jq.find('div.Info-page-pro').css('background-image', `url(${logo})`);
    }
};

const info = Vue.component('info', opts);
(<any>info).raw_component = opts;
export default info;