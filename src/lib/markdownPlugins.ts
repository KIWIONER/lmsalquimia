import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

/**
 * Rehype plugin to remove all inline on* event handler attributes (like onclick, onerror)
 * from HTML parsed elements in markdown. This prevents React invariant runtime errors.
 */
export function rehypeSanitizeEventHandlers() {
    return (tree: any) => {
        const visit = (node: any) => {
            if (node.properties && typeof node.properties === 'object') {
                for (const key of Object.keys(node.properties)) {
                    if (/^on/i.test(key)) {
                        delete node.properties[key];
                    }
                }
            }
            if (node.children && Array.isArray(node.children)) {
                node.children.forEach(visit);
            }
        };
        visit(tree);
    };
}

export const defaultRemarkPlugins = [remarkGfm];
export const defaultRehypePlugins = [rehypeRaw, rehypeSanitizeEventHandlers];
