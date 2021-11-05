
class Mutator {
    mutate(node: JQuery<Node>, cb: (mr: MutationRecord) => void): MutationObserver {
        return this.mutateOpt(node, { childList: true }, cb);
    }

    mutateAdded(node: JQuery<Node>, cb: (mra: JQuery<Node>) => void): MutationObserver {
        return this.mutate(node, mr => mr.addedNodes.forEach(el => cb(jQuery(el))));
    }

    mutateDeep(node: JQuery<Node>, cb: (mr: MutationRecord) => void): MutationObserver {
        return this.mutateOpt(node, { childList: true, subtree: true }, cb);
    }

    mutateDeepAdded(node: JQuery<Node>, cb: (mra: JQuery<Node>) => void): MutationObserver {
        return this.mutateDeep(node, mr => mr.addedNodes.forEach(el => cb(jQuery(el))));
    }

    private mutateOpt(node: JQuery<Node>, opts: MutationObserverInit, cb: (mr: MutationRecord) => void): MutationObserver {
        const obs = new MutationObserver(list => list.forEach(cb));
        node.each((i, el) => obs.observe(el, opts))
        return obs;
    }
}

const mutator = new Mutator();
export default mutator;