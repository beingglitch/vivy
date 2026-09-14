plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.vivy.collector"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.vivy.collector"
        minSdk = 26
        targetSdk = 34
        versionCode = 2
        versionName = "0.2.0"

        // Where the app syncs to, baked in so there is nothing to type on a
        // phone keyboard. Overridable in the app for local development, and
        // settable at build time for anyone running their own instance:
        //   ./gradlew assembleRelease -PvivyEndpoint=https://example.com
        buildConfigField(
            "String",
            "DEFAULT_ENDPOINT",
            "\"${project.findProperty("vivyEndpoint") ?: "https://vivy-tracker.vercel.app"}\"",
        )
    }

    buildTypes {
        debug {
            // So both can sit on the phone at once: the debug build pointed at a
            // laptop, the release build pointed at the deployed instance.
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            // Sideloaded builds are signed with the debug key so a plain
            // `assembleRelease` produces something installable. Replace this
            // before the app is ever distributed.
            signingConfig = signingConfigs.getByName("debug")
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    implementation(libs.core.ktx)
    implementation(libs.lifecycle.runtime)
    implementation(libs.lifecycle.compose)
    implementation(libs.activity.compose)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.graphics)
    implementation(libs.compose.preview)
    implementation(libs.compose.material3)

    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    implementation(libs.work.runtime)
    implementation(libs.serialization.json)
    implementation(libs.datastore)

    testImplementation(libs.junit)
}
