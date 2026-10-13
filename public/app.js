import { upload } from "@vercel/blob/client";

const form = document.querySelector("#instrument-form");
const photoInput = document.querySelector("#instrument-photo");
const preview = document.querySelector("#photo-preview");
const previewImage = document.querySelector("#preview-image");
const previewCaption = document.querySelector("#preview-caption");
const formMessage = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelEditButton = document.querySelector("#cancel-edit");
const removePhotoButton = document.querySelector("#remove-photo");
const recordsBody = document.querySelector("#records-body");
const recordCount = document.querySelector("#record-count");
const instruments = [];
let previewUrl;
let editingId;
let removeCurrentPhoto = false;

async function requestApi(url = "/api/instrumentos", options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.error || `Error del servidor (${response.status}).`);
  }

  return result;
}

function normalizeInstrument(row) {
  return {
    id: row.id,
    userName: row.usuario,
    name: row.nombre_instrumento,
    partNumber: row.numero_parte,
    serialNumber: row.numero_serie,
    photoUrl: row.foto_url,
  };
}

function showRecordsError(message) {
  recordsBody.replaceChildren();
  const row = document.createElement("tr");
  const cell = makeCell(message);
  cell.className = "empty-state";
  cell.colSpan = 6;
  row.append(cell);
  recordsBody.append(row);
  recordCount.textContent = "No disponibles";
}

async function refreshInstruments() {
  const rows = await requestApi();
  if (!Array.isArray(rows)) {
    throw new Error("La API devolvió una respuesta inesperada al cargar los instrumentos.");
  }

  instruments.splice(0, instruments.length, ...rows.map(normalizeInstrument));
  renderInstruments();
}

function clearPhotoPreview() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = undefined;
  }

  preview.hidden = true;
  previewImage.removeAttribute("src");
  previewCaption.textContent = "";
}

function showPhotoPreview(url, caption) {
  previewImage.src = url;
  previewCaption.textContent = caption;
  preview.hidden = false;
}

function makeCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  return cell;
}

function renderInstruments() {
  recordsBody.replaceChildren();
  recordCount.textContent = `${instruments.length} ${instruments.length === 1 ? "instrumento" : "instrumentos"}`;

  if (instruments.length === 0) {
    const row = document.createElement("tr");
    const cell = makeCell("Todavía no hay instrumentos registrados.");
    cell.className = "empty-state";
    cell.colSpan = 6;
    row.append(cell);
    recordsBody.append(row);
    return;
  }

  instruments.forEach((instrument) => {
    const row = document.createElement("tr");
    row.append(
      makeCell(instrument.name),
      makeCell(instrument.partNumber),
      makeCell(instrument.serialNumber),
      makeCell(instrument.userName),
    );

    const photoCell = document.createElement("td");
    if (instrument.photoUrl) {
      const image = document.createElement("img");
      image.className = "instrument-thumbnail";
      image.src = instrument.photoUrl;
      image.alt = `Foto de ${instrument.name}`;
      photoCell.append(image);
    } else {
      photoCell.textContent = "Sin foto";
      photoCell.className = "photo-empty";
    }
    row.append(photoCell);

    const actionsCell = document.createElement("td");
    actionsCell.className = "row-actions";

    const editButton = document.createElement("button");
    editButton.className = "row-action";
    editButton.type = "button";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => startEditing(instrument));

    const deleteButton = document.createElement("button");
    deleteButton.className = "row-action row-action-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Eliminar";
    deleteButton.addEventListener("click", () => deleteInstrument(instrument));

    actionsCell.append(editButton, deleteButton);
    row.append(actionsCell);
    recordsBody.append(row);
  });
}

function startEditing(instrument) {
  editingId = instrument.id;
  removeCurrentPhoto = false;
  form.elements.userName.value = instrument.userName;
  form.elements.instrumentName.value = instrument.name;
  form.elements.partNumber.value = instrument.partNumber;
  form.elements.serialNumber.value = instrument.serialNumber;
  photoInput.value = "";

  clearPhotoPreview();
  if (instrument.photoUrl) {
    showPhotoPreview(instrument.photoUrl, "Foto actual");
  }

  submitButton.firstChild.textContent = "Guardar cambios ";
  cancelEditButton.hidden = false;
  formMessage.textContent = `Editando ${instrument.name}.`;
  form.elements.instrumentName.focus();
}

function resetForm() {
  form.reset();
  editingId = undefined;
  removeCurrentPhoto = false;
  clearPhotoPreview();
  submitButton.firstChild.textContent = "Agregar instrumento ";
  cancelEditButton.hidden = true;
}

async function deleteInstrument(instrument) {
  if (!window.confirm(`¿Eliminar ${instrument.name}?`)) {
    return;
  }

  try {
    await requestApi(`/api/instrumentos?id=${encodeURIComponent(instrument.id)}`, {
      method: "DELETE",
    });

    if (editingId === instrument.id) {
      resetForm();
    }

    try {
      await refreshInstruments();
      formMessage.textContent = `${instrument.name} fue eliminado de Neon.`;
    } catch (error) {
      showRecordsError("No se pudo actualizar la lista. Recargá la página para volver a consultar Neon.");
      formMessage.textContent = `El servidor confirmó la eliminación, pero no se pudo actualizar la lista: ${error.message}`;
    }
  } catch (error) {
    formMessage.textContent = `No se pudo eliminar ${instrument.name}: ${error.message}`;
  }
}

photoInput.addEventListener("change", () => {
  const [file] = photoInput.files;
  clearPhotoPreview();

  if (!file) {
    return;
  }

  previewUrl = URL.createObjectURL(file);
  showPhotoPreview(previewUrl, file.name);
  removeCurrentPhoto = false;
  formMessage.textContent = "";
});

removePhotoButton.addEventListener("click", () => {
  photoInput.value = "";
  clearPhotoPreview();
  removeCurrentPhoto = Boolean(editingId);
  formMessage.textContent = editingId ? "La foto se quitará al guardar los cambios." : "Foto quitada.";
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
  formMessage.textContent = "Edición cancelada.";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveInstrument();
});

async function saveInstrument() {
  const currentInstrument = instruments.find((item) => item.id === editingId);
  const selectedFile = photoInput.files[0];
  const selectedPhoto = Boolean(selectedFile);
  const wasEditing = editingId !== undefined;
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (selectedFile && !allowedTypes.includes(selectedFile.type)) {
    formMessage.textContent = "La foto debe ser JPEG, PNG o WebP.";
    return;
  }

  if (selectedFile && selectedFile.size > 4 * 1024 * 1024) {
    formMessage.textContent = "La foto no puede superar los 4 MB.";
    return;
  }

  let uploadedPhoto;
  submitButton.disabled = true;
  try {
    if (selectedFile) {
      formMessage.textContent = "Subiendo foto...";
      uploadedPhoto = await upload(selectedFile.name, selectedFile, {
        handleUploadUrl: "/api/upload",
        access: "public",
      });
    }

    const payload = {
      usuario: form.elements.userName.value.trim(),
      nombre_instrumento: form.elements.instrumentName.value.trim(),
      numero_parte: form.elements.partNumber.value.trim(),
      numero_serie: form.elements.serialNumber.value.trim(),
      foto_url: removeCurrentPhoto
        ? null
        : uploadedPhoto?.url || currentInstrument?.photoUrl || null,
    };

    await requestApi(
      wasEditing
        ? `/api/instrumentos?id=${encodeURIComponent(editingId)}`
        : "/api/instrumentos",
      {
        method: wasEditing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      },
    );

    resetForm();
    try {
      await refreshInstruments();
      formMessage.textContent = selectedPhoto
        ? wasEditing
          ? "Cambios y foto guardados correctamente."
          : "Instrumento y foto guardados correctamente."
        : wasEditing
          ? "Cambios guardados correctamente en Neon."
          : "Instrumento guardado correctamente en Neon.";
    } catch (error) {
      showRecordsError("No se pudo actualizar la lista. Recargá la página para volver a consultar Neon.");
      formMessage.textContent = `La API confirmó el guardado, pero no se pudo actualizar la lista: ${error.message}`;
    }
  } catch (error) {
    formMessage.textContent = uploadedPhoto
      ? `La foto se subió, pero no se pudo ${wasEditing ? "actualizar" : "guardar"} el instrumento: ${error.message}`
      : selectedPhoto
        ? `No se pudo subir la foto: ${error.message}`
        : `No se pudo ${wasEditing ? "actualizar" : "guardar"} el instrumento: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
}

refreshInstruments().catch((error) => {
  showRecordsError("No se pudieron cargar los instrumentos desde Neon.");
  formMessage.textContent = `No se pudieron cargar los instrumentos: ${error.message}`;
});

window.addEventListener("pagehide", () => {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
});