import './style/main.less';
import './style/dev.css';
import { mainStarter } from './starter/main';

try {
  mainStarter();
} catch (e) {
  console.error('failed to boot M1Pro', e);
}
