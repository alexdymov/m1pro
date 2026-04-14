import './style/main.less';
import './style/dev.css';
import { mainStarter } from './starter/main';

try {
  if (window.location.hostname === 'demos.monopoly-one.com') {
    const sendData = () => {
      if (window === window.parent) return;
      const text = document.body?.innerText || document.documentElement?.innerText || '';
      window.parent.postMessage({
        type: 'M1PRO_DEMO_DATA',
        text: text
      }, 'https://monopoly-one.com');
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', sendData);
    } else {
      sendData();
    }
  } else {
    mainStarter();
  }
} catch (e) {
  console.error('failed to boot M1Pro', e);
}
