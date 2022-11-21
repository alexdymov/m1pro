
export const initAnalytics = process.env.TARGET === 'firefox' ? () => {} : () => {
    var ga = document.createElement('script');
    ga.type = 'text/javascript';
    ga.async = true;
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=G-RTVTXF347C';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);

    "mainWaterfall" in window && window.mainWaterfall.then(function () {
        window.dataLayer = window.dataLayer || [];
        function gtag() { window.dataLayer.push(arguments); }
        gtag('js', new Date());
        gtag('config', 'G-RTVTXF347C');
    });
};
