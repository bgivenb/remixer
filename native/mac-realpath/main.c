#include <errno.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char **argv) {
    int first_path = 1;
    if (argc > 1 && strcmp(argv[1], "--") == 0) first_path = 2;
    if (argc <= first_path) {
        fprintf(stderr, "usage: realpath [--] path ...\n");
        return 64;
    }

    for (int index = first_path; index < argc; index++) {
        char resolved[PATH_MAX];
        if (realpath(argv[index], resolved) == NULL) {
            fprintf(stderr, "realpath: %s: %s\n", argv[index], strerror(errno));
            return 1;
        }
        puts(resolved);
    }
    return 0;
}
