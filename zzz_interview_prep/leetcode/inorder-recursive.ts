// inorder: left -> root -> right
function inorder(root: TreeNode | null): number[] {
  if (!root) return [];
  const result: number[] = [];

  function dfs(node: TreeNode | null): void {
    if (node === null) return;
    dfs(node.left);
    result.push(node.val);
    dfs(node.right);
  }
  dfs(root);
  return result;
}

const myTree = {
  val: 1,
  left: { val: 2, left: null, right: null },
  right: { val: 3, left: null, right: null },
};

console.log(inorder(myTree));

export {};
