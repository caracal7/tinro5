import { getAttr, getRouteMatch } from './tinro_internal.js';
import { router } from './tinro_internal.js';

export function active(node) {
    let href;
    let exact;
    let cl;
    let current;
    let unsubscribe;

    const getAttributes = () => {
        href = getAttr(node, 'href').replace(/^\/#|[?#].*$|\/$/g, ''),
        exact = getAttr(node, 'exact', true),
        cl = getAttr(node, 'active-class', true, 'active');
    };

    const matchLink = () => {
        const match = getRouteMatch(href, current); 
        match && (match.exact && exact || !exact) ? node.classList.add(cl) : node.classList.remove(cl);
    };

    getAttributes();
    
    // Используем явное хранение подписки для более надежного управления жизненным циклом
    unsubscribe = router.subscribe(r => {
        current = r?.path || '';
        matchLink();
    });
          
    return {
        destroy: () => {
            if (unsubscribe) unsubscribe();
        },
        update: () => { 
            getAttributes(); 
            matchLink();
        }
    };
} 