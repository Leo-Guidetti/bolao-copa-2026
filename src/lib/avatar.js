// Converte um arquivo de imagem em data URL redimensionado (para guardar no banco).
export function fileToAvatar(file, max = 256) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Sem arquivo"));
    if (!file.type.startsWith("image/")) return reject(new Error("Selecione uma imagem."));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Imagem inválida."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
