import './style/main.less';
import './style/dev.css';
import { debug } from './util/debug';
import { Starter } from './starter/starter';

try {
  new Starter().start();
} catch (e) {
  console.error('failed to boot M1Pro', e);
}
