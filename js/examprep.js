import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

let CURRENT_USER = null;
let scheduleGenerated = false;

document.addEventListener("DOMContentLoaded", () => {
  console.log("ExamPrep AI loaded");

  const generateBtn = document.getElementById("generateScheduleBtn");
  const output = document.getElementById("schedule-output");
  const daysLeftInput = document.getElementById("exam-days-left");

  if (!generateBtn || !output || !daysLeftInput) {
    console.error("Exam prep elements missing");
    return;
  }

  generateBtn.addEventListener("click", generateSchedule);

  /* ---------------- PRIORITY ALGORITHM ---------------- */

  function computePriority(subject, daysLeft) {
    const difficultyWeight = subject.difficulty * 2;
    const prepGap = (100 - subject.preparation) * 1.5;

    let urgency = 0;
    if (daysLeft <= 7) urgency = 30;
    else if (daysLeft <= 14) urgency = 20;
    else if (daysLeft <= 30) urgency = 10;

    return difficultyWeight + prepGap + urgency;
  }

  /* ---------------- AI PROMPT ---------------- */

  function buildAIPrompt(subjects, daysLeft) {
    return `
You are generating an EXAM PREPARATION PLAN (not weekly timetable).

Context:
- Exam begins in ${daysLeft} days
- Subjects are already PRIORITIZED
- Higher priority = more time allocation
- Lower preparation = more revision + practice
- Higher difficulty = earlier focus

STRICT OUTPUT FORMAT (JSON ONLY):
{
  "phases": [
    {
      "title": "Phase 1: Core Strengthening",
      "timeframe": "Days 1–7",
      "focus": "Concept clarity and weak areas",
      "subjects": [
        {
          "name": "Physics",
          "timeAllocation": "2 hrs",
          "frequency": "Every day",
          "strategy": "Concept revision + solved examples"
        }
      ]
    }
  ]
}

Rules:
- EVERY phase MUST include a clear timeframe (days or weeks)
- EVERY subject MUST include:
  - timeAllocation (e.g. 2 hrs)
  - frequency (e.g. Every day / 3 sessions per week)
- Higher priority subjects get MORE time & higher frequency
- Early phases = learning + gap fixing
- Later phases = revision + mocks
- NO markdown, NO explanations, JSON ONLY

Subjects (sorted by priority):
${subjects.map(s => `
- ${s.name}
  Difficulty: ${s.difficulty}/5
  Current Prep: ${s.preparation}%
  Estimated Duration: ${s.duration} hrs
  Priority Score: ${s.priorityScore.toFixed(1)}
`).join("")}
`;
  }

  function resetGenerateButton() {
  generateBtn.disabled = false;
  generateBtn.textContent = scheduleGenerated
    ? "Regenerate Schedule"
    : "Generate Schedule";
}


  async function generateSchedule() {
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating with AI...";
    output.style.textAlign = "left";

    try {
      if (!CURRENT_USER) {
        renderMessage("Please sign in before generating a schedule.");
        resetGenerateButton();
        return;
    }


      const daysLeft = Number(daysLeftInput.value);
      if (!daysLeftInput.value) {
        renderMessage("Please enter how many days are left for your exam.");
        resetGenerateButton();
        return;
    }

      if (daysLeft <= 0) {
        renderMessage("Exam days must be greater than zero.");
        resetGenerateButton();
        return;
        }


      const snap = await getDocs(
        collection(db, "users", CURRENT_USER.uid, "examSubjects")
      );

      if (snap.empty) {
        renderMessage("Please add at least one subject before generating a plan.");
        resetGenerateButton();
        return;
    }


      let subjects = snap.docs.map(d => d.data());

      subjects = subjects.map(s => ({
        ...s,
        priorityScore: computePriority(s, daysLeft)
      }));

      subjects.sort((a, b) => b.priorityScore - a.priorityScore);

      const prompt = buildAIPrompt(subjects, daysLeft);

      const response = await fetch("/api/generate-routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You generate structured exam preparation plans in JSON only." },
            { role: "user", content: prompt }
          ]
        })
      });

      if (!response.ok) {
        renderMessage("AI service failed. Please try again.");
        resetGenerateButton();
        return;
    }


      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        renderMessage("AI returned an empty response. Please regenerate.");
        resetGenerateButton();
        return;
    }


      let plan;
      try {
        plan = JSON.parse(text.trim());
      } catch {
        renderMessage("AI response was malformed. Please regenerate.");
        resetGenerateButton();
        return;
    }


      renderPlan(plan);
      scheduleGenerated = true;
      generateBtn.textContent = "Regenerate Schedule";
      localStorage.setItem("examSchedule", JSON.stringify(plan));

    } finally {
  resetGenerateButton();
}

  }

  /* ---------------- RENDER ---------------- */

  function renderPlan(plan) {
    output.innerHTML = "";
    output.style.textAlign = "left";

    plan.phases.forEach(phase => {
      const card = document.createElement("div");
      card.style.marginBottom = "20px";
      card.style.textAlign = "left";

      const title = document.createElement("h3");
      title.textContent = `${phase.title} (${phase.timeframe})`;

      const focus = document.createElement("p");
      focus.innerHTML = `<b>Focus:</b> ${phase.focus}`;

      const list = document.createElement("ul");
      list.style.listStyle = "none";
      list.style.paddingLeft = "0";

      phase.subjects.forEach(s => {
        const li = document.createElement("li");
        li.textContent = `${s.name}: ${s.timeAllocation}, ${s.frequency} — ${s.strategy}`;
        li.style.marginBottom = "6px";
        list.appendChild(li);
      });

      card.appendChild(title);
      card.appendChild(focus);
      card.appendChild(list);
      output.appendChild(card);
    });
  }

  function renderMessage(msg) {
    output.innerHTML = `<div style="padding:16px;font-weight:600;text-align:left;">${msg}</div>`;
  }

  /* ---------------- PERSISTENCE ---------------- */

  const saved = localStorage.getItem("examSchedule");
  if (saved) {
    try {
      renderPlan(JSON.parse(saved));
      scheduleGenerated = true;
      generateBtn.textContent = "Regenerate Schedule";
    } catch {
      localStorage.removeItem("examSchedule");
    }
  }

  /* ---------------- AUTH ---------------- */

  onAuthStateChanged(auth, user => {
    if (!user) {
      localStorage.removeItem("examSchedule");
      window.location.href = "/html/loginsignup.html";
    } else {
      CURRENT_USER = user;
      console.log("ExamPrep auth ready:", user.uid);
    }
  });
});
