// inorder: left -> root -> right

function inorder(root: TreeNode | null): number[] {
  if (!root) return [];
  const result: number[] = [];
  const stack: TreeNode[] = [];
  let curr: TreeNode | null = root;

  while (curr !== null || stack.length > 0) {
    // move all the way to the left
    while (curr !== null) {
      stack.push(curr);
      curr = curr.left;
    }
    // visit
    curr = stack.pop()!;
    result.push(curr.val);
    // move right once
    curr = curr.right;
  }
  return result;
}

const t = {
  val: 1,
  left: { val: 2, left: null, right: null },
  right: { val: 3, left: null, right: null },
};
console.log(inorder(t));

export {};
