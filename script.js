let entries = [];
const RATE = 1.5; 

function parseAll() {
    const rawText = document.getElementById('rawInput').value.trim();
    if (!rawText) return;

    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l !== "");
    
    let billNo = "1";
    let detectedLottos = ["หวยลาว"];
    let billUnit = rawText.includes('€') ? '€' : '£';
    let currentCatBase = "ตรง";
    let currentPos = "บน";
    let currentMode = "single"; 
    let isBothPos = false; 

    const lottoPresets = { "กิจ": "เฉพาะกิจ", "กาชาต": "กาชาด", "พิเศษ": "พิเศษ", "ปกติ": "ปกติ", "vip": "VIP", "ลาว": "หวยลาว" };

    lines.forEach((line) => {
        // 1. ตรวจหาเลขบิล
        const billMatch = line.match(/(?:บิล|Bill)\s*(\d+)/i) || line.match(/^(\d+)\s*[🇱🇦🇻🇳]/);
        if (billMatch) {
            currentBill = billMatch[1];
            isBothPos = false;
            currentMode = "single";
            currentCatBase = "ตรง";
        }

        // 2. ตรวจหาชื่อหวย
        let lInLine = [];
        for (let k in lottoPresets) {
            if (line.toLowerCase().includes(k)) lInLine.push(lottoPresets[k]);
        }
        if (line.includes("5รอบ")) lInLine = Object.values(lottoPresets).filter(v => v !== "หวยลาว");
        if (lInLine.length > 0) detectedLottos = lInLine;

        // 3. ตรวจหาตำแหน่ง (บน/ล่าง/บ-ล)
        if (line.match(/บน-ล่าง|บ-ล|บล|บนล่าง/i)) {
            isBothPos = true;
        } else if (line.includes("ล่าง")) {
            isBothPos = false; currentPos = "ล่าง";
        } else if (line.includes("บน")) {
            isBothPos = false; currentPos = "บน";
        }

        // 4. ตรวจหาประเภท (ตรง/โต๊ด/ตรงโต๊ด)
        if (line.match(/ตรง.*โต๊ด|ตรง.*โตด|ตรง.*ตด/)) {
            currentMode = "combined"; currentCatBase = "ตรง";
        } else if (line.includes("โต๊ด") || line.includes("โตด") || line.includes("ตด")) {
            currentMode = "single"; currentCatBase = "โต๊ด";
        } else if (line.includes("ตรง")) {
            currentMode = "single"; currentCatBase = "ตรง";
        }

        // 5. ดึงสกุลเงินรายบรรทัด
        if (line.includes('€')) currentUnit = '€';
        if (line.includes('£')) currentUnit = '£';

        // 6. ดึงตัวเลขและยอดเงิน (แก้ไข Regex ให้รองรับเครื่องหมายคูณ ×)
        const regex = /((?:\d{2,4}[-,\s]*)+)\s*[=เข:\-]\s*(\d+(?:\.\d+)?)(?:\s*[xX*×]\s*(\d+(?:\.\d+)?))?/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
            let nums = match[1].split(/[-,\s]+/).filter(n => n.length >= 2);
            let amt1 = parseFloat(match[2]);
            // ถ้ามีค่าหลังเครื่องหมายคูณให้ใช้ค่านั้น ถ้าไม่มีให้เท่ากับค่าแรก
            let amt2 = match[3] ? parseFloat(match[3]) : amt1;

            nums.forEach(num => {
                detectedLottos.forEach(lotto => {
                    let prefix = (num.length === 4) ? "4" : (num.length === 3) ? "3" : "";
                    let cat = (num.length === 2) ? "2ตัว" : prefix + currentCatBase;

                    if (currentMode === "combined") {
                        let permCat = (num.length === 2) ? "2ตัว" : prefix + "โต๊ด";
                        if (isBothPos) {
                            addEntry(lotto, billNo, cat, "บน", num, amt1, billUnit);
                            addEntry(lotto, billNo, cat, "ล่าง", num, amt1, billUnit);
                            addEntry(lotto, billNo, permCat, "บน", num, amt2, billUnit);
                            addEntry(lotto, billNo, permCat, "ล่าง", num, amt2, billUnit);
                        } else {
                            addEntry(lotto, billNo, cat, currentPos, num, amt1, billUnit);
                            addEntry(lotto, billNo, permCat, currentPos, num, amt2, billUnit);
                        }
                    } else {
                        if (isBothPos) {
                            addEntry(lotto, billNo, cat, "บน", num, amt1, billUnit);
                            addEntry(lotto, billNo, cat, "ล่าง", num, amt2, billUnit);
                        } else {
                            addEntry(lotto, billNo, cat, currentPos, num, amt1, billUnit);
                        }
                    }
                });
            });
        }
    });

    renderUI();
    document.getElementById('rawInput').value = "";
}

function addEntry(l, b, c, p, n, a, u) {
    entries.push({ lottoType: l, billNo: b, category: c, position: p, num: n, inputAmt: a, symbol: u, id: Math.random() });
}

function renderUI() {
    const container = document.getElementById('bill-container');
    container.innerHTML = "";
    let gbpTracking = {}; 
    
    let grouped = entries.reduce((acc, obj) => {
        (acc[obj.billNo] = acc[obj.billNo] || []).push(obj);
        return acc;
    }, {});

    Object.keys(grouped).sort((a,b) => parseInt(a)-parseInt(b)).forEach(bill => {
        let bS28 = { '£': 0, '€': 0 }, bS22 = { '£': 0, '€': 0 };
        let rowsHtml = "";

        grouped[bill].forEach(item => {
            let limit = item.category.includes("2ตัว") ? 30 : item.category.includes("ตรง") ? 15 : 50;
            let inGbp = (item.symbol === "€") ? (item.inputAmt / RATE) : item.inputAmt;
            
            let key = `${item.lottoType}-${item.category}-${item.position}-${item.num}`;
            let prevGbp = gbpTracking[key] || 0;
            let g28 = 0, g22 = 0;

            if (prevGbp >= limit) { g22 = inGbp; } 
            else {
                if (prevGbp + inGbp <= limit) g28 = inGbp;
                else { g28 = limit - prevGbp; g22 = inGbp - g28; }
            }
            gbpTracking[key] = prevGbp + inGbp;

            let d28 = (item.symbol === "€") ? g28*RATE : g28, d22 = (item.symbol === "€") ? g22*RATE : g22;
            bS28[item.symbol] += d28; bS22[item.symbol] += d22;

            rowsHtml += `<tr>
                <td><span class="lotto-tag">${item.lottoType}</span><br>${item.category} ${item.position}</td>
                <td><b>${item.num}</b></td>
                <td>${item.inputAmt.toFixed(2)} ${item.symbol}</td>
                <td>${d28.toFixed(2)} ${item.symbol}</td>
                <td class="${d22 > 0 ? 'txt-red' : ''}">${d22.toFixed(2)} ${item.symbol}</td>
                <td><button onclick="removeEntry(${item.id})" style="border:none;background:none;cursor:pointer;">❌</button></td>
            </tr>`;
        });

        const billDiv = document.createElement('div');
        billDiv.innerHTML = `
            <div class="bill-header active" onclick="toggleBill(this)">
                <span>📄 บิลที่ ${bill}</span>
                <span class="header-total">28%: ${formatT(bS28)} | <span style="color:#ff7675;">22%: ${formatT(bS22)}</span></span>
            </div>
            <div class="bill-content show">
                <table>
                    <thead><tr><th>รายการ</th><th>เลข</th><th>ยอดรวม</th><th>28%</th><th>22%</th><th>ลบ</th></tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>`;
        container.appendChild(billDiv);
    });
}

function toggleBill(header) {
    header.classList.toggle('active');
    header.nextElementSibling.classList.toggle('show');
}

function toggleAllBills(show) {
    document.querySelectorAll('.bill-header').forEach(h => {
        show ? h.classList.add('active') : h.classList.remove('active');
        show ? h.nextElementSibling.classList.add('show') : h.nextElementSibling.classList.remove('show');
    });
}

function formatT(obj) {
    let r = []; if (obj['£'] > 0) r.push(obj['£'].toFixed(2) + "£"); if (obj['€'] > 0) r.push(obj['€'].toFixed(2) + "€");
    return r.length > 0 ? r.join("/") : "0.00";
}

function removeEntry(id) { entries = entries.filter(e => e.id !== id); renderUI(); }
function clearAll() { if(confirm("ล้างทั้งหมด?")) { entries = []; renderUI(); } }
