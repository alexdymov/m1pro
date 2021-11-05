import Vue, { PluginFunction, PluginObject } from 'vue';
import { debug } from './debug';

type ELPredicate = (el: JQuery<HTMLElement>) => boolean;
type VuePredicate = (v: Vue) => boolean;
type Handler = (comp: Vue) => void;

class VueHookerPlugin implements PluginObject<any> {
    private mountHooks: Map<ELPredicate, Handler> = new Map();
    private createHooks: Map<VuePredicate, Handler> = new Map();
    private beforeCreateHooks: Map<VuePredicate, Handler> = new Map();
    debug = false;

    install: PluginFunction<any> = (v) => {
        v.mixin({
            created: function () {
                vooker.debug && debug('created!', this.name, this.component_name, this.$options.name, this);
                vooker.createHooks.forEach((handler, predicate) => {
                    if (predicate(this)) {
                        handler(this);
                    }
                });
            },
            mounted: function () {
                vooker.debug && debug('mounted!', this.name, this.component_name, this.$options.name, this.$el, this);
                if (this.$el) {
                    vooker.mountHooks.forEach((handler, predicate) => {
                        if (predicate(jQuery(this.$el))) {
                            handler(this);
                        }
                    });
                }
            },
            beforeCreate: function() {
                vooker.debug && debug('before created!', this.$options.name, this);
                vooker.beforeCreateHooks.forEach((handler, predicate) => {
                    if (predicate(this)) {
                        handler(this);
                    }
                });
            }
        })
    }

    ifMount(predicate: ELPredicate, handler: Handler) {
        this.mountHooks.set(predicate, handler);
    }
    
    ifCreate(predicate: VuePredicate, handler: Handler) {
        this.createHooks.set(predicate, handler);
    }
    
    ifBeforeCreate(predicate: VuePredicate, handler: Handler) {
        this.beforeCreateHooks.set(predicate, handler);
    }
}

Vue.config.errorHandler = function (err, vm, info) {
    debug('vue err', err, vm, info);
}

const vooker = new VueHookerPlugin();
export default vooker;