#import <Foundation/Foundation.h>
#include <stddef.h>
#include <string.h>

// The group is supplied in the signed app's Info.plist, so ordinary builds
// without a widget never try to create a shared container.
int pupil_widget_snapshot_path(char *buffer, size_t capacity) {
    @autoreleasepool {
        NSString *group = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"PupilAppGroup"];
        if (![group isKindOfClass:[NSString class]] || group.length == 0) return 0;
        NSURL *container = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:group];
        if (!container) return 0;
        const char *path = [[[container URLByAppendingPathComponent:@"study-calendar.json"] path] fileSystemRepresentation];
        if (!path || strlen(path) + 1 > capacity) return 0;
        memcpy(buffer, path, strlen(path) + 1);
        return 1;
    }
}
