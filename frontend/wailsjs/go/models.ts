export namespace backend {
	
	export class AppSettings {
	    maxWorkers: number;
	    filterHiddenFiles: boolean;
	    filterDevFiles: boolean;
	    devFilterPatterns: string[];
	    syncBrowsing: boolean;
	    defaultTimeoutSec: number;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.maxWorkers = source["maxWorkers"];
	        this.filterHiddenFiles = source["filterHiddenFiles"];
	        this.filterDevFiles = source["filterDevFiles"];
	        this.devFilterPatterns = source["devFilterPatterns"];
	        this.syncBrowsing = source["syncBrowsing"];
	        this.defaultTimeoutSec = source["defaultTimeoutSec"];
	    }
	}
	export class ConnectionConfig {
	    protocol: string;
	    host: string;
	    port: number;
	    username: string;
	    password: string;
	    keyPath: string;
	    passiveMode: boolean;
	    timeout: number;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.protocol = source["protocol"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.keyPath = source["keyPath"];
	        this.passiveMode = source["passiveMode"];
	        this.timeout = source["timeout"];
	    }
	}
	export class FileItem {
	    name: string;
	    path: string;
	    size: number;
	    humanSize: string;
	    isDir: boolean;
	    modTime: string;
	    permissions: string;
	    ext: string;
	
	    static createFrom(source: any = {}) {
	        return new FileItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.humanSize = source["humanSize"];
	        this.isDir = source["isDir"];
	        this.modTime = source["modTime"];
	        this.permissions = source["permissions"];
	        this.ext = source["ext"];
	    }
	}
	export class QuickPath {
	    name: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new QuickPath(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	    }
	}
	export class SiteProfile {
	    id: string;
	    name: string;
	    protocol: string;
	    host: string;
	    port: number;
	    username: string;
	    password: string;
	
	    static createFrom(source: any = {}) {
	        return new SiteProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.protocol = source["protocol"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.password = source["password"];
	    }
	}
	export class TransferTask {
	    id: string;
	    name: string;
	    direction: string;
	    localPath: string;
	    remotePath: string;
	    size: number;
	    transferred: number;
	    percentage: number;
	    speed: string;
	    status: string;
	    errorMsg: string;
	    // Go type: time
	    StartedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new TransferTask(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.direction = source["direction"];
	        this.localPath = source["localPath"];
	        this.remotePath = source["remotePath"];
	        this.size = source["size"];
	        this.transferred = source["transferred"];
	        this.percentage = source["percentage"];
	        this.speed = source["speed"];
	        this.status = source["status"];
	        this.errorMsg = source["errorMsg"];
	        this.StartedAt = this.convertValues(source["StartedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

