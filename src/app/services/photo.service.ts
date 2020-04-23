import { Injectable } from '@angular/core';
import {
  Plugins, CameraResultType, Capacitor, FilesystemDirectory,
  CameraPhoto, CameraSource, FileReadResult
} from '@capacitor/core';
import { Platform } from '@ionic/angular';

const { Camera, Filesystem, Storage } = Plugins;
const PHOTO_STORAGE: string = "photos";

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  public photos: Photo[] = [];
  private platform: Platform;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  private async readAsBase64(cameraPhoto: CameraPhoto): Promise<string> {
    // "hybrid" will detect Cordova or Capacitor
    if (this.platform.is('hybrid')) {
      // Read the file into base64 format
      const file: FileReadResult = await Filesystem.readFile({
        path: cameraPhoto.path
      });

      return file.data;
    }
    else {
      const response = await fetch(cameraPhoto.webPath);
      const blob = await response.blob();

      return await this.convertBlobToBase64(blob) as string;
    }

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

    if (this.platform.is('hybrid')) {
      // Display the new image by rewriting the 'file://' path to HTTP
      // Details: https://ionicframework.com/docs/building/webview#file-protocol
      return {
        filePath: savedFile.uri,
        webViewPath: Capacitor.convertFileSrc(savedFile.uri)
      };
    }
    else {
      // Use webPath to display the new image instead of base64 since it's
      // already loaded into memory
      return {
        filePath: fileName,
        webViewPath: cameraPhoto.webPath
      };
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
      value: this.platform.is('hybrid')
        ? JSON.stringify(this.photos)
        : JSON.stringify(this.photos.map(p => {
          const photoCopy = { ...p };
          delete photoCopy.base64;

          return photoCopy;
        }))
    })
  }

  public async loadSaved(): Promise<void> {
    const photos = await Storage.get({ key: PHOTO_STORAGE });
    this.photos = JSON.parse(photos.value) || [];

    if (!this.platform.is('hybrid')) {
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

  public async deletePicture(photo: Photo, position: number): Promise<void> {
    // Remove this photo from the Photos reference data array
    this.photos.splice(position, 1);
  
    // Update photos array cache by overwriting the existing photo array
    Storage.set({
      key: PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
    });
  
    // delete photo file from filesystem
    const filename = photo.filePath
                        .substr(photo.filePath.lastIndexOf('/') + 1);
  
    await Filesystem.deleteFile({
      path: filename,
      directory: FilesystemDirectory.Data
    });
  }

}

interface Photo {
  filePath: string;
  webViewPath: string;
  base64?: string;
}
