import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

let CURRENT_USER = null;
let routineAlreadyGenerated = false;

document.addEventListener("DOMContentLoaded", () => {
  console.log("AI routine.js loaded");

  const generateBtn = document.getElementById("generateRoutineBtn");
  const container = document.querySelector(".routine-card-container");

  if (!generateBtn || !container) {
    console.error("Routine button or container not found");
    return;
  }

  generateBtn.addEventListener("click", generateRoutine);

  function buildAIPrompt(tasks, prefs) {
  const today = new Date().toISOString().split("T")[0];

  return `
You are generating a weekly study routine as JSON ONLY.

IMPORTANT CONTEXT:
- Today is ${today}
- You MUST respect task deadlines
- Tasks with earlier deadlines must be scheduled earlier
- No task may be scheduled AFTER its deadline date
- If deadlines conflict, prioritize higher priorityScore

Rules:
- Use 50-minute focus blocks
- Respect wake time: ${prefs.wakeWeekdays}
- Respect sleep time: ${prefs.bedWeekdays}
- Productive time: ${prefs.productiveTime}
- Total study hours per day: ${prefs.studyHours}
- Distribute work ACROSS DAYS until deadline
- No explanations, no markdown

Return format EXACTLY:
{
  "days": {
    "Monday": [
      { "start": "06:30", "end": "07:20", "task": "Math revision" }
    ]
  }
}

TASK LIST (with deadlines):
${tasks.map(t => `
- ${t.name}
  Duration: ${t.duration} hrs
  Priority: ${t.priorityScore}
  Deadline: ${t.deadline || "NO DEADLINE"}
`).join("")}
`;
}


  async function generateRoutine() {
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating with AI...";

    try {
      if (!CURRENT_USER) throw new Error("Auth not ready");

      const userSnap = await getDoc(doc(db, "users", CURRENT_USER.uid));
      if (!userSnap.exists()) throw new Error("User prefs missing");

      const prefs = userSnap.data();

      const tasksSnap = await getDocs(
        collection(db, "users", CURRENT_USER.uid, "tasks")
      );

      const tasks = tasksSnap.docs
      .map(d => {
        const data = d.data();

        return {
          id: d.id,
          ...data,
          deadline: data.deadline
            ? data.deadline.toDate
              ? data.deadline.toDate().toISOString().split("T")[0]
              : data.deadline
            : null
        };
      })
      .filter(t => !t.completed);


      if (!tasks.length) {
        renderMessage("No active tasks found.");
        return;
      }

      const prompt = buildAIPrompt(tasks, prefs);

      const response = await fetch("/api/generate-routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You generate structured weekly routines in JSON only." },
            { role: "user", content: prompt }
          ]
        })
      });

      if (!response.ok) throw new Error("AI request failed");

      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content;
      if (!aiText) throw new Error("Empty AI response");

      const routine = JSON.parse(aiText.trim());
      if (!routine.days) throw new Error("AI response missing `days`");

      renderRoutine(routine);
      routineAlreadyGenerated = true;                
      generateBtn.textContent = "Regenerate Routine"; 

    } catch (err) {
      console.error(err);
      renderMessage("Failed to generate AI routine. Try again.");
    } finally {
      generateBtn.disabled = false;
      if (!routineAlreadyGenerated) {
        generateBtn.textContent = "Generate Routine";
      }
    }
  }

  function renderRoutine(routine) {
    container.innerHTML = "";

    const scroll = document.createElement("div");
    scroll.style.maxHeight = "360px";
    scroll.style.overflowY = "auto";
    scroll.style.padding = "20px";
    scroll.style.width = "100%";
    scroll.style.textAlign = "left";

    Object.entries(routine.days).forEach(([day, blocks]) => {
      if (!Array.isArray(blocks) || !blocks.length) return;

      const dayCard = document.createElement("div");
      dayCard.style.marginBottom = "18px";

      const title = document.createElement("h3");
      title.textContent = day;

      const list = document.createElement("ul");
      list.style.listStyle = "none";
      list.style.paddingLeft = "0";

      blocks.forEach(b => {
        const li = document.createElement("li");
        li.textContent = `${b.start} – ${b.end}: ${b.task} (50 min work + 10 min break)`;
        li.style.marginBottom = "6px";
        list.appendChild(li);
      });

      dayCard.appendChild(title);
      dayCard.appendChild(list);
      scroll.appendChild(dayCard);
    });

    container.appendChild(scroll);

    localStorage.setItem("weeklyRoutine", JSON.stringify(routine));
  }

  function renderMessage(msg) {
    container.innerHTML = `
      <div style="padding:20px;font-weight:600;text-align:center;">
        ${msg}
      </div>
    `;
  }
  const savedRoutine = localStorage.getItem("weeklyRoutine");
  if (savedRoutine) {
    try {
      const routine = JSON.parse(savedRoutine);
      renderRoutine(routine);
      routineAlreadyGenerated = true;
      generateBtn.textContent = "Regenerate Routine";
    } catch {
      localStorage.removeItem("weeklyRoutine");
    }
  }

  onAuthStateChanged(auth, user => {
    if (!user) {
      localStorage.removeItem("weeklyRoutine");
      window.location.href = "/html/loginsignup.html";
    } else {
      CURRENT_USER = user;
      console.log("Auth ready:", user.uid);
    }
  });
});
