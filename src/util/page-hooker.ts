import { debug } from "./debug";

type PagePredicate = (page: Location) => boolean;
type PageHandler = (dyn?: boolean) => void;

class PageHooker {
    private hooks: Map<PagePredicate, PageHandler> = new Map();

    public add(predicate: PagePredicate, handler: PageHandler) {
        this.hooks.set(predicate, handler);
    }

    public run() {
        require('./history');
        window.addEventListener('locationchange', () => {
            debug('loc change', location);
            this.check(true);
        });
        this.check(false);
    }

    private check(dyn: boolean) {
        this.hooks.forEach((handler, predicate) => {
            if (predicate(location)) {
                handler(dyn);
            }
        });
    }
}

const pooker = new PageHooker();
export default pooker;