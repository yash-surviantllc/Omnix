import sys

def check_balance(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    line_num = 1
    col_num = 0
    
    for i, char in enumerate(content):
        if char == '\n':
            line_num += 1
            col_num = 0
            continue
        col_num += 1
        
        if char in '({[':
            stack.append((char, line_num, col_num))
        elif char in ')}]':
            if not stack:
                print(f"Extra closing {char} at line {line_num}, col {col_num}")
                return
            top, l, c = stack.pop()
            if (char == ')' and top != '(') or \
               (char == '}' and top != '{') or \
               (char == ']' and top != '['):
                print(f"Mismatch: {top} at {l}:{c} closed by {char} at {line_num}:{col_num}")
                return

    if stack:
        print("Unclosed brackets left on stack:")
        for b in stack:
            print(f"  {b[0]} at line {b[1]}, col {b[2]}")
    else:
        print("Braces and brackets are perfectly balanced!")

if __name__ == '__main__':
    check_balance(sys.argv[1])
