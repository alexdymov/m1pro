import pooker from "../../util/page-hooker";
import MainState from '../../components/main-state';

export const expmain = process.env.NODE_ENV === 'production' ? (state: MainState) => { } : (state: MainState) => {
}