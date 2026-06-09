with open('src/components/ManageBills.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = "    setNewBillWarn(bill.warnIfZero || false);\n    setNewBillIsLoan(bill.isLoan || false);\n    setNewBillTotalDebt(bill.totalDebt !== undefined ? bill.totalDebt.toString() : '');\n    \n    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });\n  };\n\n  const handleEditPrivateBill"
new = "    setNewBillWarn(bill.warnIfZero || false);\n    setNewBillIsLoan(bill.isLoan || false);\n    setNewBillTotalDebt(bill.totalDebt !== undefined ? bill.totalDebt.toString() : '');\n    setNewBillAutoTransfer(bill.isAutoTransfer || false);\n    \n    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });\n  };\n\n  const handleEditPrivateBill"

if old in content:
    result = content.replace(old, new, 1)
    with open('src/components/ManageBills.tsx', 'w', encoding='utf-8') as f:
        f.write(result)
    print('Done - replaced successfully')
else:
    print('NOT FOUND - checking line endings')
    old_cr = old.replace('\n', '\r\n')
    if old_cr in content:
        result = content.replace(old_cr, new.replace('\n', '\r\n'), 1)
        with open('src/components/ManageBills.tsx', 'w', encoding='utf-8') as f:
            f.write(result)
        print('Done - replaced with CRLF')
    else:
        print('Still not found')
