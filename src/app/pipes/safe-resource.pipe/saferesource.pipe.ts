import { Pipe } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser'

@Pipe({name: 'safeURL'})
export class SafeResourcePipe {
  constructor(private sanitizer: DomSanitizer){}

  transform(html: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(html);
  }
}
