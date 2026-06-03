/**
 * Tree node types and utilities.
 * This file has NO Node.js dependencies and is safe for client-side imports.
 */

export interface TreeNode {
  name: string;
  type: "directory" | "file";
  children?: TreeNode[];
  path: string; // relative path from DATA_ROOT
}

/**
 * Strip project prefix and .md suffix from tree paths.
 * Converts full paths (e.g. "personal/default/projects/{id}/Root/test.md")
 * to relative paths (e.g. "Root/test").
 */

/** Compute a default directory name, handling conflicts (Folder, Folder(1), ...) */
export function computeDefaultDirName(existingChildren: TreeNode[]): string {
  const baseName = "Folder";
  const existingNames = new Set(
    existingChildren.filter((n) => n.type === "directory").map((n) => n.name),
  );
  if (!existingNames.has(baseName)) return baseName;
  let i = 1;
  while (existingNames.has(`${baseName}(${i})`)) i++;
  return `${baseName}(${i})`;
}

/** Compute a default file name, handling conflicts (Untitled.md, Untitled(1).md, ...) */
export function computeDefaultFileName(existingChildren: TreeNode[]): string {
  const baseName = "Untitled";
  const ext = ".md";
  const existingNames = new Set(
    existingChildren.filter((n) => n.type === "file").map((n) => n.name),
  );
  if (!existingNames.has(`${baseName}${ext}`)) return `${baseName}${ext}`;
  let i = 1;
  while (existingNames.has(`${baseName}(${i})${ext}`)) i++;
  return `${baseName}(${i})${ext}`;
}

/** Find children nodes for a given parent path */
export function findChildren(nodes: TreeNode[], parentPath: string): TreeNode[] {
  for (const node of nodes) {
    if (node.path === parentPath && node.children) return node.children;
    if (node.children) {
      const found = findChildren(node.children, parentPath);
      if (found.length > 0) return found;
    }
  }
  return [];
}

/** Find a node by its relative path */
export function findNodeByPath(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

/** Rename a node in the tree (updates name, path, and all descendant paths for directories) */
export function renameNodeInTree(nodes: TreeNode[], oldPath: string, newName: string): TreeNode[] {
  return nodes.map((node) => {
    if (node.path === oldPath) {
      const newPath = oldPath.includes("/")
        ? oldPath.replace(/[^/]*$/, newName)
        : newName;
      return {
        ...node,
        name: newName,
        path: newPath,
        ...(node.children
          ? { children: updateDescendantPaths(node.children, oldPath, newPath) }
          : {}),
      };
    }
    if (node.children) {
      return { ...node, children: renameNodeInTree(node.children, oldPath, newName) };
    }
    return node;
  });
}

/** Update descendant paths when a directory is renamed */
function updateDescendantPaths(children: TreeNode[], oldParent: string, newParent: string): TreeNode[] {
  return children.map((child) => {
    const newPath = newParent + child.path.slice(oldParent.length);
    return {
      ...child,
      path: newPath,
      ...(child.children
        ? { children: updateDescendantPaths(child.children, oldParent, newParent) }
        : {}),
    };
  });
}
/** Insert a node into the tree under the given parent path */
export function insertNode(nodes: TreeNode[], parentPath: string, newNode: TreeNode): TreeNode[] {
  return nodes.map((node) => {
    if (node.path === parentPath) {
      return { ...node, children: [...(node.children || []), newNode] };
    }
    if (node.children) {
      return { ...node, children: insertNode(node.children, parentPath, newNode) };
    }
    return node;
  });
}

/**
 * Strip project prefix from tree paths.
 *
 * Converts full paths (e.g. "personal/default/projects/{id}/Root/test.md")
 * to relative paths (e.g. "Root/test.md").
 */
export function stripTreePrefix(
  nodes: TreeNode[],
  prefix: string,
): TreeNode[] {
  return nodes.map((node) => {
    let relPath = node.path;
    if (relPath.startsWith(prefix + "/")) {
      relPath = relPath.slice(prefix.length + 1);
    } else if (relPath.startsWith(prefix)) {
      relPath = relPath.slice(prefix.length);
    }
    return {
      ...node,
      path: relPath,
      ...(node.children
        ? { children: stripTreePrefix(node.children, prefix) }
        : {}),
    };
  });
}
