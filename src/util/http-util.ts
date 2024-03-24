import { MResp } from "../shared/beans";

type CallableWithToken = (token: string) => PromiseLike<any>;
type RespHandle = (resp: MResp<any>) => PromiseLike<any>;
type Handler = (resolve: () => any, callable: CallableWithToken) => (RespHandle);

export const handleResponse: Handler = (resolve, callable) => {
    return (res: MResp<any>) => {
        const def = $.Deferred();
        if (res.code) {
            if (res.code === 8) {
                return window._require.async('/js/vuem/Captcha.js').then(() => {
                    return window._libs.dialog.show({ component: "captcha", buttons: [{ is_default: true, title: "Отмена" }] })
                        .then((tkn: string) => callable(tkn));
                })
            }
            return def.reject(res);
        } else {
            return def.resolve(res.data).then(resolve);
        }
    };
}