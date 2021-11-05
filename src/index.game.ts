import './style/main.less';
import './style/dev.css';
import { gameStarter } from './starter/game';

try {
  gameStarter();
} catch (e) {
  console.error('failed to boot M1Pro', e);
}
