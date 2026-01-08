import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { auth, db } from "/js/firebase.js";
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

(() => {
    const modal = document.getElementById('subject-modal');
    const openBtn = document.getElementById('openSubjectModal');
    const closeBtns = document.querySelectorAll('.modal-close');
    const subjectForm = document.getElementById('subject-form');
    const subjectListContainer = document.getElementById('subject-list-container');
    const diffSlider = document.getElementById('sub-diff');
    const diffOutput = document.getElementById('diff-val');

    let subjects = [];
    let userId = null;

    /* ---------- MODAL CONTROLS ---------- */
    const openModal = () => modal.classList.add('open');

    const closeModal = () => {
        modal.classList.remove('open');
        subjectForm.reset();
        diffOutput.value = diffSlider.value;
    };

    openBtn.addEventListener('click', openModal);
    closeBtns.forEach(btn => btn.addEventListener('click', closeModal));

    /* ---------- SLIDER UI ---------- */
    diffSlider.addEventListener('input', () => {
        diffOutput.value = diffSlider.value;
    });

    /* ---------- RENDER SUBJECTS ---------- */
    function renderSubjects() {
        subjectListContainer.innerHTML = '';

        subjects.forEach(sub => {
            const div = document.createElement('div');
            div.className = 'subject-item';

            div.innerHTML = `
                <div>
                    <div class="sub-title">${sub.name}</div>
                    <div class="sub-info-text">
                        Difficulty: ${sub.difficulty}/5 &nbsp;
                        Estimated Duration: ${sub.duration} hrs &nbsp;
                        Current Prep: ${sub.preparation}%
                    </div>
                </div>
                <button class="btn-delete-sub"><i class="fa-solid fa-trash"></i></button>
            `;

            div.querySelector('.btn-delete-sub')
                .addEventListener('click', () => deleteSubject(sub.id));

            subjectListContainer.appendChild(div);
        });
    }

    /* ---------- ADD SUBJECT ---------- */
    async function addSubject(e) {
    e.preventDefault();
    if (!userId) return;

    const rawName = document.getElementById('sub-name').value.trim();
    const normalizedName = rawName.toLowerCase();
    const isDuplicate = subjects.some(
        sub => sub.name.trim().toLowerCase() === normalizedName
    );

    if (isDuplicate) {
        alert("This subject already exists.");
        return;
    }

    const submitBtn = subjectForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const newSub = {
        id: Date.now().toString(),
        name: rawName,
        difficulty: Number(diffSlider.value),
        duration: Number(document.getElementById('sub-duration').value),
        preparation: Number(document.getElementById('sub-prep').value),
        createdAt: new Date()
    };

    // Close instantly for smooth UX
    closeModal();

    try {
        await setDoc(
            doc(db, "users", userId, "examSubjects", newSub.id),
            newSub
        );
    } catch (err) {
        console.error("Error adding subject:", err);
        alert("Failed to add subject. Please try again.");
    } finally {
        submitBtn.disabled = false;
    }
}


    subjectForm.addEventListener('submit', addSubject);

    /* ---------- DELETE SUBJECT ---------- */
    async function deleteSubject(id) {
        if (!confirm("Delete this subject?")) return;

        try {
            await deleteDoc(doc(db, "users", userId, "examSubjects", id));
        } catch (err) {
            console.error("Error deleting subject:", err);
        }
    }

    /* ---------- AUTH + REALTIME ---------- */
    onAuthStateChanged(auth, user => {
        if (!user) {
            window.location.href = "/html/loginsignup.html";
            return;
        }

        userId = user.uid;

        const subCol = collection(db, "users", userId, "examSubjects");
        const q = query(subCol, orderBy("createdAt", "asc"));

        onSnapshot(q, snapshot => {
            subjects = snapshot.docs.map(doc => doc.data());
            renderSubjects();
        });
    });
})();
