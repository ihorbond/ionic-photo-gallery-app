import { Injectable } from '@angular/core';
import { Plugins, CameraResultType, Capacitor, FilesystemDirectory, 
  CameraPhoto, CameraSource } from '@capacitor/core';

const { Camera, Filesystem, Storage } = Plugins;
const PHOTO_STORAGE: string = "photos";

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  public photos: Photo[] = [];

  constructor() { }

  private async readAsBase64(cameraPhoto: CameraPhoto) {
    // Fetch the photo, read as a blob, then convert to base64 format
    const response = await fetch(cameraPhoto.webPath!);
    const blob = await response.blob();
  
    return await this.convertBlobToBase64(blob) as string;  
  }
  
  convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader;
    reader.onerror = reject;
    reader.onload = () => {
        resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });

  private async savePicture(cameraPhoto: CameraPhoto): Promise<Photo> {
    const base64Data = await this.readAsBase64(cameraPhoto);

    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: FilesystemDirectory.Data
    });

    return {
      filePath: fileName,
      webViewPath: cameraPhoto.webPath
    }
  }

  public async addNewToGallery(): Promise<void> {
    const capturePhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    });

    const savedImageFile = await this.savePicture(capturePhoto);
    this.photos.unshift(savedImageFile);

    Storage.set({
      key: PHOTO_STORAGE,
      value: JSON.stringify(this.photos.map(p => {
        const photoCopy = { ...p };
        delete photoCopy.base64;

        return photoCopy;
      }))
    })
  }

  public async loadSaved(): Promise<void> {
    const photos = await Storage.get({ key: PHOTO_STORAGE });
    this.photos = JSON.parse(photos.value) || [];
  
    // Display the photo by reading into base64 format
    this.photos.forEach(async p => {
      const readFile = await Filesystem.readFile({
        path: p.filePath,
        directory: FilesystemDirectory.Data
      });
  
      // Web platform only: Save the photo into the base64 field
      p.base64 = `data:image/jpeg;base64,${readFile.data}`;
    });
  }
}

interface Photo {
  filePath: string;
  webViewPath: string;
  base64?: string;
}
