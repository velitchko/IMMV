import { Pipe } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser'

@Pipe({name: 'safeHTML'})
export class SafeHtmlPipe {
  constructor(private sanitizer: DomSanitizer){}

  transform(html: string) {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
